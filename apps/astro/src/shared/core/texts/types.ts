export type Translation = Record<string, Record<string, string>>;

export type Modifiers = Record<string, (value: any) => string | number>;

type Prettify<T> = { [Key in keyof T]: T[Key] } & {};

// The double "extends" is necessary to make sure IsAny<[not any]>
// returns *false* and not *boolean*.
type IsAny<T> = (any extends T ? true : false) extends true ? true : false;

type WithVariable<
  TName extends string,
  TRest extends string
> = `${string}{{${TName}}}${TRest}`;

type GetVariablesImpl<
  TString extends string,
  TObject extends { [key: string]: string | number }
> = TString extends WithVariable<infer VariableName, infer Rest>
  ? GetVariablesImpl<Rest, TObject & { [key in VariableName]: string | number }>
  : TString extends `${string}(${string}|${string})${string}`
  ? Prettify<TObject & { count?: number }>
  : Prettify<TObject>;

// TypeScript IntelliSense enters an infinite loading state if "any"
// is passed to GetVariables without it being handled separately.
export type GetVariables<TString extends string> = IsAny<TString> extends true
  ? {}
  : GetVariablesImpl<TString, {}>;
