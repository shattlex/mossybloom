import { useEffect, useMemo, useState } from "react";
import { Heart, LogOut, Package, User } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router";
import {
  ApiRequestError,
  changePassword,
  clearAuthToken,
  getAuthToken,
  getOAuthStartUrl,
  isApiRequestError,
  login,
  me,
  myOrders,
  register,
  resendEmailCode,
  setAuthToken,
  updateProfile,
  verifyEmailCode,
  type OrderHistoryItem,
  type UserProfile
} from "../api/client";
import { AddressAutocompleteInput } from "../components/AddressAutocompleteInput";
import { products } from "../data";
import { useFavorites } from "../context/FavoritesContext";

type AuthMode = "login" | "register";
type TabKey = "info" | "orders" | "favorites";

const statusColor: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  paid: "bg-sky-100 text-sky-700",
  assembled: "bg-amber-100 text-amber-700",
  out_for_delivery: "bg-purple-100 text-purple-700",
  delivered: "bg-emerald-100 text-emerald-700"
};

function toReadableError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message?.trim();
  if (!message) return fallback;

  // Backend can return cp1251/utf8 mojibake strings like "РќРµ..."
  const looksBroken = /(?:Р.|С.|Ð.|Ñ.){3,}/.test(message) || message.includes("\\uFFFD");
  return looksBroken ? fallback : message;
}

export function Profile() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);

  const [loginForm, setLoginForm] = useState({ login: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", lastName: "", username: "", email: "", phone: "", password: "" });
  const [registerConsents, setRegisterConsents] = useState({ personalData: false, terms: false });
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [pendingVerificationPassword, setPendingVerificationPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowTs, setNowTs] = useState(Date.now());

  const [profileForm, setProfileForm] = useState({ name: "", lastName: "", username: "", phone: "", email: "" });
  const [defaultAddress, setDefaultAddress] = useState("");
  const [profileConsentAccepted, setProfileConsentAccepted] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const { favoriteIds, clearFavorites } = useFavorites();
  const favoriteProducts = useMemo(() => products.filter((product) => favoriteIds.includes(product.id)), [favoriteIds]);

  const queryTab = searchParams.get("tab");
  const defaultTab: TabKey = location.pathname === "/favorites" ? "favorites" : "info";
  const activeTab: TabKey = queryTab === "orders" || queryTab === "favorites" ? queryTab : defaultTab;
  const resendSecondsLeft = Math.max(0, Math.ceil((resendAvailableAt - nowTs) / 1000));

  useEffect(() => {
    const authToken = searchParams.get("authToken");
    if (authToken) {
      setAuthToken(authToken);
      searchParams.delete("authToken");
      setSearchParams(searchParams);
    }

    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    void loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile) return;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const ordersResponse = await myOrders();
          setOrders(ordersResponse.orders || []);
        } catch {
          // Keep the last successful list if polling fails.
        }
      })();
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [profile]);

  useEffect(() => {
    if (!pendingVerificationEmail || resendAvailableAt <= Date.now()) return undefined;
    const timerId = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [pendingVerificationEmail, resendAvailableAt]);

  async function loadAccount() {
    try {
      setLoading(true);
      setError("");
      const [meResponse, ordersResponse] = await Promise.all([me(), myOrders()]);
      setProfile(meResponse.user);
      setOrders(ordersResponse.orders || []);
      setProfileForm({
        name: meResponse.user.name || "",
        lastName: meResponse.user.last_name || "",
        username: meResponse.user.username || "",
        phone: meResponse.user.phone || "",
        email: meResponse.user.email || ""
      });
      setDefaultAddress(meResponse.user.default_delivery_address || "");
    } catch (requestError) {
      clearAuthToken();
      setProfile(null);
      setOrders([]);
      setError(toReadableError(requestError, "Не удалось загрузить кабинет."));
    } finally {
      setLoading(false);
    }
  }

  function beginEmailVerificationFlow(email: string, passwordForAutoLogin = "") {
    setPendingVerificationEmail(email);
    setPendingVerificationPassword(passwordForAutoLogin);
    setVerificationCode("");
    setResendAvailableAt(Date.now() + 60 * 1000);
    setNowTs(Date.now());
    setMessage(`Мы отправили код подтверждения на ${email}.`);
  }

  function setTab(tab: TabKey) {
    setSearchParams({ tab });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError("");
      const response = await login(loginForm);
      setAuthToken(response.token);
      await loadAccount();
    } catch (authError) {
      if (isApiRequestError(authError) && authError.payload.requiresEmailVerification && typeof authError.payload.email === "string") {
        beginEmailVerificationFlow(authError.payload.email, loginForm.password);
        setMessage(authError.payload.message || "Подтвердите email, чтобы завершить вход.");
        return;
      }
      setError(toReadableError(authError, "Ошибка входа."));
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!registerConsents.personalData || !registerConsents.terms) {
      setError("Для регистрации нужно принять обязательные согласия.");
      return;
    }

    try {
      setError("");
      const response = await register({
        ...registerForm,
        consentPersonalData: registerConsents.personalData,
        consentTerms: registerConsents.terms
      });
      if ("requiresEmailVerification" in response && response.requiresEmailVerification) {
        beginEmailVerificationFlow(response.email, registerForm.password);
        setMessage("Код подтверждения отправлен на email.");
        return;
      }
      setAuthToken(response.token);
      await loadAccount();
    } catch (authError) {
      setError(toReadableError(authError, "Ошибка регистрации."));
    }
  }

  async function handleOAuth(provider: "google" | "yandex") {
    try {
      const url = await getOAuthStartUrl(provider);
      window.location.href = url;
    } catch (oauthError) {
      setError(toReadableError(oauthError, "Не удалось начать OAuth-вход."));
    }
  }

  async function handleVerifyEmailCode(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingVerificationEmail) return;
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError("Введите 6-значный код из письма.");
      return;
    }

    try {
      setVerifySubmitting(true);
      setError("");
      await verifyEmailCode({
        email: pendingVerificationEmail,
        code: verificationCode.trim()
      });

      if (pendingVerificationPassword) {
        const loginResponse = await login({
          login: pendingVerificationEmail,
          password: pendingVerificationPassword
        });
        setPendingVerificationEmail("");
        setPendingVerificationPassword("");
        setVerificationCode("");
        setAuthToken(loginResponse.token);
        await loadAccount();
        setMessage("Email подтвержден. Вы успешно вошли в аккаунт.");
        return;
      }

      setPendingVerificationEmail("");
      setPendingVerificationPassword("");
      setVerificationCode("");
      setMessage("Email подтвержден. Теперь вы можете войти в аккаунт.");
    } catch (verifyError) {
      setError(toReadableError(verifyError, "Не удалось подтвердить email."));
    } finally {
      setVerifySubmitting(false);
    }
  }

  async function handleResendEmailCode() {
    if (!pendingVerificationEmail) return;
    if (Date.now() < resendAvailableAt) return;

    try {
      setResendingCode(true);
      setError("");
      const response = await resendEmailCode({ email: pendingVerificationEmail });
      setResendAvailableAt(Date.now() + (Number(response.resendAvailableIn || 60) * 1000));
      setNowTs(Date.now());
      if (response.emailVerified) {
        setPendingVerificationEmail("");
        setPendingVerificationPassword("");
        setVerificationCode("");
        setMessage("Email уже подтвержден. Войдите в аккаунт.");
        return;
      }
      setMessage(response.message || "Новый код отправлен.");
    } catch (resendError) {
      if (resendError instanceof ApiRequestError && Number(resendError.payload.retryAfterSeconds) > 0) {
        setResendAvailableAt(Date.now() + Number(resendError.payload.retryAfterSeconds) * 1000);
        setNowTs(Date.now());
      }
      setError(toReadableError(resendError, "Не удалось отправить код повторно."));
    } finally {
      setResendingCode(false);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profileConsentAccepted) {
      setError("Подтвердите согласие на обработку персональных данных.");
      return;
    }

    try {
      setSavingProfile(true);
      setError("");
      const response = await updateProfile({
        name: profileForm.name,
        lastName: profileForm.lastName,
        username: profileForm.username,
        phone: profileForm.phone,
        email: profileForm.email,
        defaultDeliveryAddress: defaultAddress
      });
      setProfile(response.user);
      setMessage("Профиль обновлён.");
    } catch (saveError) {
      setError(toReadableError(saveError, "Не удалось сохранить профиль."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingPassword(true);
      setError("");
      await changePassword(passwordForm);
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setMessage("Пароль обновлён.");
    } catch (saveError) {
      setError(toReadableError(saveError, "Не удалось изменить пароль."));
    } finally {
      setSavingPassword(false);
    }
  }

  function logout() {
    clearAuthToken();
    setProfile(null);
    setOrders([]);
    setMessage("Вы вышли из аккаунта.");
  }

  if (loading) {
    return <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-20 text-stone-600">Загрузка личного кабинета...</div>;
  }

  if (!profile) {
    return (
      <div className="max-w-[980px] mx-auto px-6 md:px-12 py-12">
        <h1 className="text-5xl font-serif text-stone-900 mb-8">Личный кабинет</h1>

        <div className="bg-white border border-stone-200 rounded-3xl p-8 md:p-10">
          {pendingVerificationEmail ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-serif text-stone-900">Подтверждение email</h2>
              <p className="text-stone-600">
                Мы отправили 6-значный код на <b>{pendingVerificationEmail}</b>. Введите его, чтобы завершить регистрацию.
              </p>
              <form onSubmit={handleVerifyEmailCode} className="space-y-3">
                <input
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="Код из письма"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3"
                />
                <button
                  type="submit"
                  disabled={verifySubmitting || verificationCode.length !== 6}
                  className="w-full bg-stone-900 text-white rounded-xl py-3 disabled:opacity-70"
                >
                  {verifySubmitting ? "Проверяем..." : "Подтвердить email"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => void handleResendEmailCode()}
                disabled={resendingCode || resendSecondsLeft > 0}
                className="w-full border border-stone-200 rounded-xl py-3 hover:bg-stone-50 disabled:opacity-70"
              >
                {resendingCode
                  ? "Отправляем..."
                  : resendSecondsLeft > 0
                    ? `Отправить код повторно (${resendSecondsLeft}с)`
                    : "Отправить код повторно"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingVerificationEmail("");
                  setPendingVerificationPassword("");
                  setVerificationCode("");
                }}
                className="w-full text-sm text-stone-500 hover:text-stone-900 underline"
              >
                Изменить email и зарегистрироваться заново
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-6 flex-wrap">
                <button onClick={() => setAuthMode("login")} className={`px-4 py-2 rounded-full ${authMode === "login" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>Вход</button>
                <button onClick={() => setAuthMode("register")} className={`px-4 py-2 rounded-full ${authMode === "register" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>Регистрация</button>
              </div>

              {authMode === "login" && (
                <form onSubmit={handleLogin} className="space-y-3">
                  <input required placeholder="Email, телефон или логин" value={loginForm.login} onChange={(e) => setLoginForm((prev) => ({ ...prev, login: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-4 py-3" />
                  <input required type="password" placeholder="Пароль" value={loginForm.password} onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-4 py-3" />
                  <button type="submit" className="w-full bg-stone-900 text-white rounded-xl py-3">Войти</button>
                </form>
              )}

              {authMode === "register" && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input placeholder="Фамилия" value={registerForm.lastName} onChange={(e) => setRegisterForm((prev) => ({ ...prev, lastName: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-4 py-3" />
                    <input required placeholder="Имя" value={registerForm.name} onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-4 py-3" />
                  </div>
                  <input required placeholder="Логин" value={registerForm.username} onChange={(e) => setRegisterForm((prev) => ({ ...prev, username: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-4 py-3" />
                  <input required placeholder="Email" value={registerForm.email} onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-4 py-3" />
                  <input placeholder="Телефон" value={registerForm.phone} onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-4 py-3" />
                  <input required type="password" placeholder="Пароль" value={registerForm.password} onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-4 py-3" />

                  <label className="flex items-start gap-2 text-sm text-stone-700">
                    <input type="checkbox" checked={registerConsents.personalData} onChange={(e) => setRegisterConsents((prev) => ({ ...prev, personalData: e.target.checked }))} className="mt-1" />
                    <span>Принимаю <Link to="/privacy" className="text-[#C2958B] hover:underline">политику конфиденциальности</Link> и <Link to="/consent" className="text-[#C2958B] hover:underline">согласие на обработку ПДн</Link>.</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-stone-700">
                    <input type="checkbox" checked={registerConsents.terms} onChange={(e) => setRegisterConsents((prev) => ({ ...prev, terms: e.target.checked }))} className="mt-1" />
                    <span>Принимаю условия <Link to="/terms" className="text-[#C2958B] hover:underline">пользовательского соглашения</Link>.</span>
                  </label>

                  <button type="submit" disabled={!registerConsents.personalData || !registerConsents.terms} className="w-full bg-stone-900 text-white rounded-xl py-3 disabled:opacity-70">Создать аккаунт</button>
                </form>
              )}

              <div className="my-6 border-t border-stone-200" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => void handleOAuth("google")} className="w-full border border-stone-200 rounded-xl py-3 hover:bg-stone-50">Войти через Google</button>
                <button onClick={() => void handleOAuth("yandex")} className="w-full border border-stone-200 rounded-xl py-3 hover:bg-stone-50">Войти через Яндекс</button>
              </div>
            </>
          )}

          {error && <p className="mt-4 text-red-600">{error}</p>}
          {message && <p className="mt-4 text-emerald-600">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12 md:py-20 w-full flex-1">
      <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-12 flex flex-wrap items-center gap-4">
        <Link to="/" className="hover:text-stone-900 transition-colors">Главная</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <span className="text-stone-900 font-medium">Личный кабинет</span>
      </div>

      <h1 className="text-5xl md:text-6xl font-serif text-stone-900 tracking-tight mb-16 leading-none">Личный кабинет</h1>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-start">
        <aside className="w-full lg:w-[280px] flex-shrink-0 flex flex-col gap-8 lg:sticky lg:top-32">
          <div className="bg-[#FAFAFA] p-8 rounded-3xl border border-stone-100 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-stone-200 rounded-full mb-5 flex items-center justify-center text-stone-500 overflow-hidden shadow-sm">
              <span className="text-2xl font-serif tracking-widest">{(profile.name || "U").slice(0, 1).toUpperCase()}</span>
            </div>
            <span className="text-xl font-serif text-stone-900 mb-1">{`${profile.name || ""} ${profile.last_name || ""}`.trim() || profile.username || "Пользователь"}</span>
            <span className="text-[13px] font-light text-stone-500 tracking-wide">{profile.phone || profile.email || "контакт не указан"}</span>
          </div>

          <nav className="flex flex-row overflow-x-auto lg:flex-col gap-2 pb-4 lg:pb-0 hide-scrollbar">
            <button onClick={() => setTab("info")} className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all whitespace-nowrap ${activeTab === "info" ? "bg-[#C2958B] text-white" : "text-stone-600 hover:bg-[#FAFAFA]"}`}>
              <User size={18} />
              Личные данные
            </button>
            <button onClick={() => setTab("orders")} className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all whitespace-nowrap ${activeTab === "orders" ? "bg-[#C2958B] text-white" : "text-stone-600 hover:bg-[#FAFAFA]"}`}>
              <Package size={18} />
              История заказов
            </button>
            <button onClick={() => setTab("favorites")} className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all whitespace-nowrap ${activeTab === "favorites" ? "bg-[#C2958B] text-white" : "text-stone-600 hover:bg-[#FAFAFA]"}`}>
              <Heart size={18} />
              Избранное
            </button>
            <button onClick={logout} className="flex items-center gap-4 px-6 py-4 rounded-2xl text-stone-400 hover:bg-stone-50 hover:text-red-500 transition-all whitespace-nowrap">
              <LogOut size={18} />
              Выйти
            </button>
          </nav>
        </aside>

        <div className="flex-1 w-full min-w-0">
          {activeTab === "info" && (
            <div className="space-y-8">
              <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-stone-100">
                <h2 className="text-3xl font-serif text-stone-900 mb-8">Личные данные</h2>
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input value={profileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Имя" className="w-full border border-stone-200 rounded-xl p-4" required />
                    <input value={profileForm.lastName} onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Фамилия" className="w-full border border-stone-200 rounded-xl p-4" />
                    <input value={profileForm.username} onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))} placeholder="Логин" className="w-full border border-stone-200 rounded-xl p-4" required />
                    <input value={profileForm.phone} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон" className="w-full border border-stone-200 rounded-xl p-4" required />
                    <input type="email" value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className="w-full border border-stone-200 rounded-xl p-4 md:col-span-2" />
                  </div>

                  <AddressAutocompleteInput value={defaultAddress} onChange={setDefaultAddress} rows={3} placeholder="Адрес по умолчанию" />

                  <label className="flex items-start gap-2 text-sm text-stone-700">
                    <input type="checkbox" checked={profileConsentAccepted} onChange={(e) => setProfileConsentAccepted(e.target.checked)} className="mt-1" />
                    <span>Подтверждаю согласие на обработку персональных данных в соответствии с <Link to="/privacy" className="text-[#C2958B] hover:underline">политикой конфиденциальности</Link>.</span>
                  </label>

                  <button type="submit" disabled={savingProfile || !profileConsentAccepted} className="bg-stone-900 text-white rounded-xl px-6 py-3 disabled:opacity-70">
                    {savingProfile ? "Сохраняем..." : "Сохранить"}
                  </button>
                </form>
              </div>

              <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-stone-100">
                <h2 className="text-3xl font-serif text-stone-900 mb-8">Смена пароля</h2>
                <form onSubmit={handlePasswordSave} className="space-y-4 max-w-3xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="password" required minLength={6} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} placeholder="Новый пароль" className="w-full border border-stone-200 rounded-xl p-4" />
                    <input type="password" required minLength={6} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Подтвердите пароль" className="w-full border border-stone-200 rounded-xl p-4" />
                  </div>
                  <button type="submit" disabled={savingPassword} className="bg-stone-900 text-white rounded-xl px-6 py-3 disabled:opacity-70">
                    {savingPassword ? "Сохраняем..." : "Обновить пароль"}
                  </button>
                </form>
              </div>

            </div>
          )}

          {activeTab === "orders" && (
            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-stone-100 space-y-4">
              <h2 className="text-3xl font-serif text-stone-900 mb-2">История заказов</h2>

              {orders.length === 0 && <p className="text-stone-500">Заказов пока нет.</p>}

              {orders.map((order) => (
                <div key={order.id} className="border border-stone-200 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="font-medium">Заказ {order.id}</p>
                      <p className="text-sm text-stone-500">{new Date(order.created_at).toLocaleString("ru-RU")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-3 py-1 rounded-full ${statusColor[order.status] || "bg-stone-100 text-stone-700"}`}>{order.status_label}</span>
                      <span className="text-xs px-3 py-1 rounded-full bg-stone-100 text-stone-700">{order.payment_status === "paid" ? "Оплачен" : "Ожидает оплату"}</span>
                    </div>
                  </div>

                  <p className="text-sm text-stone-700">Адрес: {order.delivery_address}</p>
                  <p className="text-sm text-stone-700">Получатель: {order.recipient_mode === "other" ? order.recipient_name || "Другой получатель" : order.payer_name}</p>

                  <div className="mt-3 space-y-1">
                    {(order.items_json || []).map((item, index) => (
                      <p key={`${order.id}-${index}`} className="text-sm text-stone-600">• {item.name} × {item.quantity}</p>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <p className="font-medium">Итого: {Number(order.total).toLocaleString("ru-RU")} ₽</p>
                    {order.receipt_path ? (
                      <a href={order.receipt_path} target="_blank" rel="noreferrer" className="text-[#C2958B] underline">Скачать PDF-чек</a>
                    ) : (
                      <span className="text-sm text-stone-500">Чек появится после успешной оплаты</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "favorites" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-3xl font-serif text-stone-900">Избранное</h2>
                {favoriteProducts.length > 0 && (
                  <button onClick={clearFavorites} className="text-sm text-[#C2958B] hover:underline">Очистить избранное</button>
                )}
              </div>

              {favoriteProducts.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-3xl p-10 text-stone-500">Список избранного пуст.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {favoriteProducts.map((product) => (
                    <Link key={product.id} to={`/product/${product.id}`} className="group rounded-2xl p-4 bg-white border border-stone-100 hover:shadow-md transition-shadow">
                      <img src={product.image} alt={product.title} className="w-full aspect-[3/4] object-cover rounded-xl mb-4" />
                      <h3 className="text-lg font-serif text-stone-900 group-hover:text-[#C2958B] transition-colors">{product.title}</h3>
                      <p className="text-stone-500">{product.price.toLocaleString("ru-RU")} ₽</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-6 text-red-600">{error}</p>}
          {message && <p className="mt-6 text-emerald-600">{message}</p>}
        </div>
      </div>
    </div>
  );
}

