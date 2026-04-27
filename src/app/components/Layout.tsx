import { Outlet } from "react-router";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { ScrollToTop } from "./ScrollToTop";
import { CookiesBanner } from "./CookiesBanner";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-stone-900 font-sans selection:bg-[#C2958B]/20 selection:text-stone-900">
      <ScrollToTop />
      <Header />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <Footer />
      <CookiesBanner />
    </div>
  );
}

