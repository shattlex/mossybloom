import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  clearAuthToken,
  getAuthToken,
  getOAuthStartUrl,
  login,
  me,
  myOrders,
  register,
  requestSmsCode,
  setAuthToken,
  updateProfile,
  verifySmsCode,
  type OrderHistoryItem,
  type UserProfile
} from '../api/client';

type AuthMode = 'login' | 'register';

const statusColor: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  assembled: 'bg-amber-100 text-amber-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700'
};

export function Account() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);

  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [smsForm, setSmsForm] = useState({ phone: '', code: '', name: '' });
  const [registerConsents, setRegisterConsents] = useState({ personalData: false, terms: false });
  const [smsConsents, setSmsConsents] = useState({ personalData: false, terms: false });
  const [devCode, setDevCode] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' });
  const [defaultAddress, setDefaultAddress] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [profileConsentAccepted, setProfileConsentAccepted] = useState(false);

  const isAuthenticated = Boolean(profile);

  useEffect(() => {
    const authToken = searchParams.get('authToken');
    if (authToken) {
      setAuthToken(authToken);
      searchParams.delete('authToken');
      setSearchParams(searchParams);
    }

    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    void loadAccount();
  }, []);

  const totalSpent = useMemo(() => {
    return orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  }, [orders]);

  async function loadAccount() {
    try {
      setLoading(true);
      setError('');
      const [meResp, ordersResp] = await Promise.all([me(), myOrders()]);
      setProfile(meResp.user);
      setProfileForm({
        name: meResp.user.name || '',
        phone: meResp.user.phone || '',
        email: meResp.user.email || ''
      });
      setDefaultAddress(meResp.user.default_delivery_address || '');
      setOrders(ordersResp.orders || []);
    } catch (err) {
      clearAuthToken();
      setProfile(null);
      setOrders([]);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить личный кабинет.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError('');
      const response = await login(loginForm);
      setAuthToken(response.token);
      await loadAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа.');
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!registerConsents.personalData || !registerConsents.terms) {
      setError('Для регистрации нужно принять политику обработки персональных данных и пользовательское соглашение.');
      return;
    }

    try {
      setError('');
      const response = await register({
        ...registerForm,
        consentPersonalData: registerConsents.personalData,
        consentTerms: registerConsents.terms
      });
      setAuthToken(response.token);
      await loadAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации.');
    }
  }

  async function handleSmsRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!smsConsents.personalData || !smsConsents.terms) {
      setError('Для входа по SMS нужно принять политику обработки персональных данных и пользовательское соглашение.');
      return;
    }

    try {
      setError('');
      setMessage('');
      const response = await requestSmsCode(smsForm.phone, smsConsents.personalData, smsConsents.terms);
      setDevCode(response.devCode || '');
      setMessage('Код отправлен.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код.');
    }
  }

  async function handleSmsVerify(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError('');
      const response = await verifySmsCode({
        phone: smsForm.phone,
        code: smsForm.code,
        name: smsForm.name
      });
      setAuthToken(response.token);
      await loadAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код.');
    }
  }

  async function handleOAuth(provider: 'google' | 'yandex') {
    try {
      const url = await getOAuthStartUrl(provider);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось начать OAuth вход.');
    }
  }

  async function handleAddressSave(e: React.FormEvent) {
    e.preventDefault();
    if (isSavingAddress) return;
    if (!profileConsentAccepted) {
      setError('Для сохранения данных подтвердите согласие на обработку персональных данных.');
      return;
    }

    try {
      setError('');
      setMessage('');
      setIsSavingAddress(true);
      const response = await updateProfile({
        name: profileForm.name,
        phone: profileForm.phone,
        email: profileForm.email,
        defaultDeliveryAddress: defaultAddress
      });
      setProfile(response.user);
      setProfileForm({
        name: response.user.name || '',
        phone: response.user.phone || '',
        email: response.user.email || ''
      });
      setDefaultAddress(response.user.default_delivery_address || '');
      setMessage('Данные плательщика и адрес доставки сохранены.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить данные профиля.');
    } finally {
      setIsSavingAddress(false);
    }
  }

  function logout() {
    clearAuthToken();
    setProfile(null);
    setOrders([]);
    setMessage('Вы вышли из аккаунта.');
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-60 pb-20 flex items-center justify-center" style={{ fontFamily: 'var(--font-sans)' }}>
        <p className="text-gray-600">Загрузка личного кабинета...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-60 pb-20" style={{ fontFamily: 'var(--font-sans)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl font-light italic mb-6" style={{ fontFamily: 'var(--font-script)' }}>
            Личный кабинет
          </h1>
          <p className="text-gray-600 mb-8">
            Войдите, чтобы видеть статусы заказов, прошлые покупки и PDF-чек.
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              <button onClick={() => setMode('login')} className={`px-4 py-2 rounded-full ${mode === 'login' ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                Вход
              </button>
              <button onClick={() => setMode('register')} className={`px-4 py-2 rounded-full ${mode === 'register' ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                Регистрация
              </button>
            </div>

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  required
                  placeholder="Email или телефон"
                  value={loginForm.login}
                  onChange={(e) => setLoginForm({ ...loginForm, login: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3"
                />
                <input
                  required
                  type="password"
                  placeholder="Пароль"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3"
                />
                <button type="submit" className="w-full bg-primary text-white rounded-xl py-3">Войти</button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <input
                  required
                  placeholder="Имя"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3"
                />
                <input
                  placeholder="Email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3"
                />
                <input
                  placeholder="Телефон"
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3"
                />
                <input
                  required
                  type="password"
                  placeholder="Пароль"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3"
                />
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={registerConsents.personalData}
                    onChange={(e) => setRegisterConsents((prev) => ({ ...prev, personalData: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    Я принимаю <Link to="/privacy" className="text-primary hover:underline">Политику конфиденциальности</Link> и <Link to="/consent" className="text-primary hover:underline">согласие на обработку ПДн</Link>.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={registerConsents.terms}
                    onChange={(e) => setRegisterConsents((prev) => ({ ...prev, terms: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    Я принимаю условия <Link to="/terms" className="text-primary hover:underline">Пользовательского соглашения</Link>.
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={!registerConsents.personalData || !registerConsents.terms}
                  className="w-full bg-primary text-white rounded-xl py-3 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  Создать аккаунт
                </button>
              </form>
            )}

            <div className="my-6 border-t border-gray-200" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => void handleOAuth('google')} className="w-full border border-gray-200 rounded-xl py-3 hover:bg-gray-50">
                Войти через Google
              </button>
              <button onClick={() => void handleOAuth('yandex')} className="w-full border border-gray-200 rounded-xl py-3 hover:bg-gray-50">
                Войти через Яндекс
              </button>
            </div>

            {error && <p className="mt-4 text-red-600">{error}</p>}
            {message && <p className="mt-4 text-emerald-600">{message}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-60 pb-20" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-5xl font-light italic" style={{ fontFamily: 'var(--font-script)' }}>
              Личный кабинет
            </h1>
            <p className="text-gray-600 mt-2">{profile?.name} · {profile?.email || profile?.phone || 'контакт не указан'}</p>
          </div>
          <button onClick={logout} className="border border-gray-200 rounded-full px-5 py-2 hover:bg-gray-50">Выйти</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm text-gray-600">Всего заказов</p>
            <p className="text-3xl mt-1">{orders.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm text-gray-600">Оплачено</p>
            <p className="text-3xl mt-1">{totalSpent.toLocaleString('ru-RU')} ₽</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm text-gray-600">Последний статус</p>
            <p className="text-xl mt-2">{orders[0]?.status_label || 'Нет заказов'}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-2xl mb-2">Данные заказа по умолчанию</h2>
          <p className="text-sm text-gray-600 mb-4">
            Эти данные будут подставляться автоматически при новом заказе.
          </p>

          <form onSubmit={handleAddressSave} className="space-y-3">
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              placeholder="Имя плательщика"
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
            />
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
              required
              placeholder="+7 (999) 123-45-67"
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
            />
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
            />
            <textarea
              value={defaultAddress}
              onChange={(e) => setDefaultAddress(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Введите адрес доставки"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 resize-none"
            />
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profileConsentAccepted}
                onChange={(e) => setProfileConsentAccepted(e.target.checked)}
                className="mt-1"
              />
              <span>
                Я подтверждаю согласие на обработку персональных данных в соответствии с <Link to="/privacy" className="text-primary hover:underline">Политикой конфиденциальности</Link>.
              </span>
            </label>
            <button
              type="submit"
              disabled={isSavingAddress || !profileConsentAccepted}
              className="bg-primary text-white rounded-xl px-5 py-3 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSavingAddress ? 'Сохраняем...' : 'Сохранить данные'}
            </button>
          </form>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-2xl mb-4">История заказов</h2>

          {orders.length === 0 && (
            <p className="text-gray-600">
              У вас пока нет заказов. <Link to="/catalog" className="text-primary underline">Перейти в каталог</Link>
            </p>
          )}

          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="font-medium">Заказ {order.id}</p>
                    <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString('ru-RU')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full ${statusColor[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {order.status_label}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                      {order.payment_status === 'paid' ? 'Оплачен' : 'Ожидает оплату'}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-gray-700 space-y-1">
                  <p>Адрес: {order.delivery_address}</p>
                  <p>Получатель: {order.recipient_mode === 'other' ? order.recipient_name || 'Другой получатель' : order.payer_name}</p>
                </div>

                <div className="mt-3 space-y-1">
                  {(order.items_json || []).map((item, index) => (
                    <p key={`${order.id}-${index}`} className="text-sm text-gray-600">• {item.name} × {item.quantity}</p>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="font-medium">Итого: {Number(order.total).toLocaleString('ru-RU')} ₽</p>
                  {order.receipt_path ? (
                    <a href={order.receipt_path} target="_blank" rel="noreferrer" className="text-primary underline">
                      Скачать PDF-чек
                    </a>
                  ) : (
                    <span className="text-sm text-gray-500">Чек появится после успешной оплаты</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {message && <p className="text-emerald-600">{message}</p>}
      </div>
    </div>
  );
}
