import type { Repository } from "@nanokit/proxy-patterns/repository";

export type ProductId = string;

export type Product = {
  productId: ProductId;
  name: string;
  price: number;
};

export const ProductRepository = "ProductRepository";
export type ProductRepository = Repository<ProductId, Product>;
