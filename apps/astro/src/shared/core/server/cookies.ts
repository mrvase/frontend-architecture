import { type SerializeOptions, parse, serialize } from "cookie";
import { decode, encode } from "./crypto";
export type { SerializeOptions } from "cookie";

type ResponseCookie<Name extends string = string, Value = any> = Omit<
  SerializeOptions,
  "encode"
> & {
  name: Name;
  value: Value;
  encrypt?: boolean;
};

type RequestCookie<Name extends string = string, Value = any> = {
  name: Name;
  value: Value;
};

export const RequestCookieRepository = Symbol("RequestCookieRepository");
export type RequestCookieRepository<T extends Record<string, any> = Record<string, any>> = {
  get size(): number;
  get<Name extends keyof T>(
    name: Name
  ): (Name extends string ? RequestCookie<Name, T[Name]> : never) | undefined;
  has(name: string): boolean;
};

export const ResponseCookieRepository = Symbol("ResponseCookieRepository");
export type ResponseCookieRepository<T extends Record<string, any> = Record<string, any>> = {
  set<Name extends keyof T & string>(
    ...args:
      | [key: Name, value: T[Name], cookie?: Partial<ResponseCookie<Name, T[Name]>>]
      | [options: ResponseCookie<Name, T[Name]>]
  ): Promise<void>;
  delete(name: string, options: Partial<ResponseCookie>): Promise<void>;
};

const PREFIX = "sf";

const CookieFormat = {
  Encrypted: "e",
  Signed: "s",
  Plain: "c",
};

export const createRequestCookieRepository = async <
  T extends Record<string, any> = Record<string, any>,
>(
  cookieHeader: string,
  secret?: string
) => {
  const cookies = parse(cookieHeader);

  const entries: [string, any][] = [];

  await Promise.all(
    Object.entries(cookies).map(async ([prefixedName, string]) => {
      const [prefix, format, ...rest] = prefixedName.split(".");
      const name = rest.join(".");
      if (
        secret &&
        prefix === PREFIX &&
        [CookieFormat.Encrypted, CookieFormat.Signed, CookieFormat.Plain].includes(format) &&
        name !== ""
      ) {
        let value: unknown = string;
        if (format !== CookieFormat.Plain && typeof string === "string") {
          value = await decode(string, {
            secret,
            decrypt: format === "e",
          });
          if (!value) return;
        }
        entries.push([name, { name, value }]);
      }
    })
  );

  return new Map<string, RequestCookie>(entries) as RequestCookieRepository<T>;
};

export const createResponseCookieRepository = <T extends Record<string, any> = Record<string, any>>(
  headers: Headers,
  secret?: string
) => {
  const setCookie = async (el: ResponseCookie) => {
    const isDeleting = el.value === "" && el.maxAge === 0;

    const code = el.httpOnly
      ? el.encrypt
        ? CookieFormat.Encrypted
        : CookieFormat.Signed
      : CookieFormat.Plain;

    const name = `${PREFIX}.${code}.${el.name}`;

    const value =
      el.httpOnly && !isDeleting
        ? await encode(el.value, {
            secret,
            encrypt: el.encrypt,
          })
        : el.value;

    headers.append("Set-Cookie", serialize(name, value, el));
  };

  const setCookies = new Map<string, ResponseCookie>();
  const obj: ResponseCookieRepository<T> = {
    async set(...args) {
      const [arg1, arg2, arg3] = args;
      if (typeof arg1 === "object") {
        await setCookie(arg1);
      } else {
        await setCookie({
          name: arg1,
          value: arg2,
          ...arg3,
        });
      }
    },
    async delete(name, options) {
      const exists = setCookies.get(name);
      if (exists && exists.maxAge !== 0) {
      } else {
        await setCookie({
          ...options,
          name,
          value: "",
          maxAge: 0,
        });
      }
    },
  };
  return obj;
};
