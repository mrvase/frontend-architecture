import {
  createTexts,
  type Text,
  type TextRecord,
  type TextsProxyInner,
} from "../texts/texts-proxy";

export type Href<T extends Record<string, unknown> = {}> = Text<T>;

export type RoutesProxy<T extends TextRecord> = {
  routes: TextsProxyInner<T>;
};

export const createRoutes = createTexts;
