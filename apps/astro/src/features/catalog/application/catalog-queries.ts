import { Inject } from "@nanokit/proxy";
import { ProductRepository } from "../domain/product";

export const catalogQueries = {
  getProducts: async () => {
    const products = Inject(ProductRepository);
    return Array.from(products.values());
  },
};
