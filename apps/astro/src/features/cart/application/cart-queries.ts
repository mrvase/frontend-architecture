import { Inject } from "@nanokit/proxy";
import { ProductRepository } from "../domain/product";

export const cartQueries = {
  getCartItems: async () => {
    const products = Inject(ProductRepository);
    return Array.from(products.values());
  },
};
