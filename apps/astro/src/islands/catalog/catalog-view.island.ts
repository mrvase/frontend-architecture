import { createIsland } from "./_create";
import { CatalogView } from "src/features/catalog/ui/catalog-view";

export const CatalogViewIsland = createIsland(CatalogView);

CatalogViewIsland.prefetch = CatalogView.prefetch;
