import { Inject } from "@nanokit/proxy";
import { useQuery } from "@nanokit/proxy-signals/react";
import { useRoutes } from "src/shared/core/router/use-route";
import { useTexts } from "src/shared/core/texts/use-texts";

const { cartQueries } = Inject.proxy();

export function CatalogView() {
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
