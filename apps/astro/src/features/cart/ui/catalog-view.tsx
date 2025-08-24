import { Inject } from "@nanokit/proxy";
import { useQuery, useStore } from "@nanokit/proxy-signals/react";
import { useRoutes } from "src/shared/core/router/use-route";
import { useTexts } from "src/shared/core/texts/use-texts";

const { cartQueries } = Inject.requests;

export function CatalogView() {
  const store = useStore(cartQueries.getCartItems());

  const t = useTexts();
  const routes = useRoutes();

  const { data: cartItems } = useQuery(cartQueries.getCartItems());

  return (
    <div>
      <a href={routes.checkout()}>{t.cartSummary.cart()}</a>
    </div>
  );
}

CatalogView.prefetch = [cartQueries.getCartItems()];
