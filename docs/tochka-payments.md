# Tochka Payment Links Integration

## Required env vars

Backend requires these variables at startup:

- `TOCHKA_API_BASE`
- `TOCHKA_CLIENT_ID`
- `TOCHKA_JWT`
- `TOCHKA_CUSTOMER_CODE`
- `DATABASE_URL`

Optional for signed webhook verification:

- `TOCHKA_WEBHOOK_PUBLIC_KEY`

## Backend routes

- `POST /api/payments/tochka/create`
  - body:
    - `amount`
    - `description`
    - `orderId`
    - `redirectUrl` (optional)
    - `failRedirectUrl` (optional)
    - `paymentMode` (optional)
    - `ttl` (optional)
    - `merchantId` (optional)

- `GET /api/payments/tochka/status/:operationId`

- `POST /api/payments/tochka/webhook`

## Frontend route usage

Frontend should call only your backend API:

- `createTochkaPayment(...)` from [`src/app/api/client.ts`](C:/Users/shattlex/Documents/Codex/SaraFlowers%202.0/src/app/api/client.ts)

Never call Tochka API directly from browser and never expose `TOCHKA_JWT` in frontend.

## Webhook URL registration

Register your public webhook URL in Tochka merchant settings:

- `https://<your-domain>/api/payments/tochka/webhook`

## Status check

To check payment status by operation:

- `GET /api/payments/tochka/status/:operationId`

This route requests current status from Tochka and updates local order payment status.

## Successful flow

1. Frontend calls `POST /api/payments/tochka/create`.
2. Backend creates payment link in Tochka and stores:
   - `orderId`
   - `operationId`
   - `paymentLink`
   - `status`
   - `amount`
3. Frontend redirects user to `paymentLink`.
4. After payment, backend receives webhook and/or frontend polls status endpoint.
5. Order is updated to paid state and stays monotonic (no status rollback to earlier states).

## Notes

- `paymentLinkId` uses `orderId` for idempotency.
- If payment for `orderId` already exists, create endpoint returns existing link/operation.
- Errors from Tochka are returned as safe `message + details` (without token leakage).
