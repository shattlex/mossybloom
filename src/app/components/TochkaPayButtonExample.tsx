import { useState } from 'react';
import { redirectToTochkaPayment } from '../api/client';

interface TochkaPayButtonExampleProps {
  amount: number;
  description: string;
  orderId: string;
}

// Example usage for a checkout button:
// <TochkaPayButtonExample amount={4500} description="Оплата заказа SF-123" orderId="SF-123" />
export function TochkaPayButtonExample({ amount, description, orderId }: TochkaPayButtonExampleProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePayClick() {
    try {
      setLoading(true);
      setError('');
      await redirectToTochkaPayment({ amount, description, orderId });
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Не удалось создать ссылку на оплату.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePayClick}
        disabled={loading}
        className="rounded-xl bg-stone-900 px-5 py-3 text-sm uppercase tracking-[0.12em] text-white disabled:opacity-70"
      >
        {loading ? 'Создаем ссылку...' : 'Оплатить через Tochka'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
