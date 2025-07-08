import { createRoutes } from "src/shared/core/router/routes-proxy";
import { text } from "src/shared/core/texts/texts-proxy";
import type { Routes } from "src/features/catalog/infrastructure/routes";

export const routes = createRoutes<Routes>({
  checkout: text("/checkout"),
  product: text("/product/{{productId}}"),
});
