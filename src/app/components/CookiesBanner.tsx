import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getCookieConsent, saveCookieConsent } from "../lib/cookieConsent";

export function CookiesBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(!getCookieConsent());
  }, []);

  const handleAcceptAll = () => {
    saveCookieConsent("all");
    setIsVisible(false);
  };

  const handleNecessaryOnly = () => {
    saveCookieConsent("necessary");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-4 shadow-xl sm:p-5">
        <p className="text-sm text-stone-700" style={{ fontFamily: "var(--font-sans)" }}>
          Мы используем обязательные cookies для корректной работы сайта. Дополнительно вы можете
          разрешить cookies аналитики для улучшения сервиса. Подробнее в{" "}
          <Link to="/privacy" className="text-[#C2958B] hover:underline">
            политике конфиденциальности
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleNecessaryOnly}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-100"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Только обязательные
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white transition-colors hover:bg-[#C2958B]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Принять все
          </button>
        </div>
      </div>
    </div>
  );
}

