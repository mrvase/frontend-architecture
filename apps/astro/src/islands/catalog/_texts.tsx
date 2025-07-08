import { Inject } from "@nanokit/proxy";
import { createTexts, text } from "src/shared/core/texts/texts-proxy";
import type { Texts } from "src/features/catalog/infrastructure/texts";

const textsApi = Inject.proxy().catalogQueries.getProducts();

export const texts = createTexts<Texts>({
  cartSummary: {
    cart: textsApi.select(() => text("bla")),
  },
  form: {
    required: text("Required {{count}}"),
  },
});
