import type { Text, TextsProxy } from "src/shared/core/texts/texts-proxy";

export type Texts = {
  cartSummary: {
    cart: Text;
  };
  form: {
    required: Text<{ count: string | number }>;
  };
};

declare module "@nanokit/proxy" {
  interface Handlers extends TextsProxy<Texts> {}
}
