import * as infra from "src/features/catalog/infrastructure/handlers";
import { create } from "../handler-util";

export const { cache, handlers, interceptors, dispatchIntegrationEvent } =
  create(infra);
