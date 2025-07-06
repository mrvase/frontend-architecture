import { handlers } from "@nanokit/proxy";

export function CartSummary() {
  return <div>CartSummary</div>;
}

CartSummary.prefetch = [handlers.cartQueries.getCart()];
