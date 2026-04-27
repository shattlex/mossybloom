import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { CartProvider } from "./context/CartContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { router } from "./routes";
import { getProducts } from "./data/products";
import { generatedConstructorFlowers } from "./data/generatedContentMedia";

export default function App() {
  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;

    const isConstrainedNetwork =
      Boolean(connection?.saveData) ||
      connection?.effectiveType === "2g" ||
      connection?.effectiveType === "slow-2g";

    const runWhenIdle = (callback: () => void) => {
      if (typeof window === "undefined") return;
      const withIdle = window as Window & {
        requestIdleCallback?: (cb: () => void) => number;
      };
      if (typeof withIdle.requestIdleCallback === "function") {
        withIdle.requestIdleCallback(callback);
      } else {
        window.setTimeout(callback, 300);
      }
    };

    const preloadImage = (url: string) => {
      if (!url) return;
      const image = new Image();
      image.decoding = "async";
      image.src = url;
    };

    // Warm up only a small subset of images to avoid mobile jank.
    runWhenIdle(() => {
      if (isConstrainedNetwork) return;
      getProducts().slice(0, 4).forEach((product) => {
        preloadImage(product.thumbnail || product.image);
      });
    });

    runWhenIdle(() => {
      if (isConstrainedNetwork) return;
      generatedConstructorFlowers.slice(0, 4).forEach((flower) => {
        preloadImage(flower.image.replace("/products/constructor/", "/products/constructor-previews/"));
      });
    });
  }, []);

  return (
    <FavoritesProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </FavoritesProvider>
  );
}
