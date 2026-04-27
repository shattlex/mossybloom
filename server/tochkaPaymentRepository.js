function normalizeRecord(row) {
  if (!row) return null;
  return {
    orderId: row.id,
    operationId: row.tochka_operation_id || row.payment_id || null,
    paymentLink: row.payment_url || null,
    amount: Number(row.total || 0),
    status: row.payment_raw_status || 'CREATED',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getStatusRank(status) {
  const normalized = String(status || '').toUpperCase();
  const ranks = {
    CREATED: 10,
    PENDING: 20,
    AUTHORIZED: 30,
    APPROVED: 40,
    SUCCEEDED: 40,
    SUCCESS: 40,
    FAILED: 50,
    DECLINED: 50,
    CANCELED: 50,
    CANCELLED: 50
  };
  return ranks[normalized] ?? 0;
}

export function shouldAdvancePaymentStatus(currentStatus, nextStatus) {
  return getStatusRank(nextStatus) >= getStatusRank(currentStatus);
}

export function createTochkaPaymentRepository(pool) {
  return {
    async createPaymentRecord({ orderId, operationId, paymentLink, amount, status, rawPayload }) {
      await pool.query(
        `UPDATE orders
         SET payment_provider = 'tochka',
             payment_id = $1,
             tochka_operation_id = $1,
             payment_url = $2,
             payment_raw_status = $3,
             tochka_last_payload = $4::jsonb,
             total = COALESCE(NULLIF($5::numeric, 0), total),
             updated_at = NOW()
         WHERE id = $6`,
        [operationId, paymentLink, status, JSON.stringify(rawPayload ?? {}), Number(amount || 0), orderId]
      );
      const record = await this.getPaymentByOrderId(orderId);
      return record;
    },

    async updatePaymentStatus({ operationId, status, rawPayload }) {
      const current = await this.getPaymentByOperationId(operationId);
      if (!current) return null;

      if (!shouldAdvancePaymentStatus(current.status, status)) {
        return current;
      }

      await pool.query(
        `UPDATE orders
         SET payment_raw_status = $1,
             tochka_last_payload = $2::jsonb,
             updated_at = NOW()
         WHERE tochka_operation_id = $3`,
        [status, JSON.stringify(rawPayload ?? {}), operationId]
      );
      return this.getPaymentByOperationId(operationId);
    },

    async getPaymentByOperationId(operationId) {
      const result = await pool.query(
        `SELECT id, total, payment_id, payment_url, payment_raw_status, created_at, updated_at, tochka_operation_id
         FROM orders
         WHERE tochka_operation_id = $1
         LIMIT 1`,
        [operationId]
      );
      return normalizeRecord(result.rows[0]);
    },

    async getPaymentByOrderId(orderId) {
      const result = await pool.query(
        `SELECT id, total, payment_id, payment_url, payment_raw_status, created_at, updated_at, tochka_operation_id
         FROM orders
         WHERE id = $1
         LIMIT 1`,
        [orderId]
      );
      return normalizeRecord(result.rows[0]);
    }
  };
}
