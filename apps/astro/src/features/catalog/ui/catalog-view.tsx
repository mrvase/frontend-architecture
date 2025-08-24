import { Inject } from "@nanokit/proxy";
import { useQuery } from "@nanokit/proxy-signals/react";
import { useRoutes } from "src/shared/core/router/use-route";
import { useTexts } from "src/shared/core/texts/use-texts";

const { catalogQueries } = Inject.requests;

export function CatalogView() {
  const t = useTexts();
  const routes = useRoutes();
  const { data: products } = useQuery(catalogQueries.getProducts());

  return (
    <div>
      <a href={routes.checkout()}>{t.form.required({ count: 0 })}</a>
    </div>
  );
}

CatalogView.prefetch = [catalogQueries.getProducts()];
