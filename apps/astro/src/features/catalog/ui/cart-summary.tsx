import { handlers } from "@nanokit/proxy";

function CartSummary() {
  return <div>CartSummary</div>;
}

CartSummary.prefetch = [handlers.catalogQueries.getProducts()];

export { CartSummary };
