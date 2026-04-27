import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { LegalDocumentPage } from "./components/LegalDocumentPage";
import { Home } from "./pages/Home";
import { Catalog } from "./pages/Catalog";
import { ProductDetail } from "./pages/ProductDetail";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { OrderSuccess } from "./pages/OrderSuccess";
import { InfoPage } from "./pages/InfoPage";
import { Profile } from "./pages/Profile";
import { BouquetBuilder } from "./pages/BouquetBuilder";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "catalog", Component: Catalog },
      { path: "product/:id", Component: ProductDetail },
      { path: "cart", Component: Cart },
      { path: "checkout", Component: Checkout },
      { path: "order-success", Component: OrderSuccess },
      { path: "delivery", Component: InfoPage },
      { path: "about", Component: InfoPage },
      { path: "faq", Component: InfoPage },
      { path: "guarantee", Component: InfoPage },
      { path: "contacts", Component: InfoPage },
      { path: "bouquet-builder", Component: BouquetBuilder },
      { path: "profile", Component: Profile },
      { path: "account", Component: Profile },
      { path: "favorites", Component: Profile },
      { path: "oferta", element: <LegalDocumentPage documentKey="oferta" /> },
      { path: "privacy", element: <LegalDocumentPage documentKey="privacy" /> },
      { path: "consent", element: <LegalDocumentPage documentKey="consent" /> },
      { path: "terms", element: <LegalDocumentPage documentKey="terms" /> }
    ]
  }
]);
