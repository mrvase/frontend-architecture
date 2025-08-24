import { Inject } from "@nanokit/proxy";
import { ProductRepository } from "../domain/product";

export const cartQueries = {
  getCartItems: async () => {
    const { cartQueries } = Inject.requests;
    const { [ProductRepository]: products } = Inject.injectables;

    return Array.from(products.values());
  },
};
