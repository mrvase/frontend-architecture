import { useContext, useMemo } from "react";
import type {
  FragmentConfig,
  InferFormData,
  InferFormState,
  FormError,
  JsonValue,
} from "../types";
import { createValidationCache } from "../core/validate";
import { getFieldData } from "../core/field-data";
import { createEventBus } from "../utils/event-bus";
import { FormFragmentContext } from "./form-fragment-context";
import { FormChangePlugin, FormSubmitPlugin } from "./form-plugins";
import { getInitialValues, mergeMaps } from "../core/initial-values";

export function FormFragment<T extends FragmentConfig<any, any>>({
  children,
  config,
  onSubmit,
  onChange,
  initialValues,
}: {
  children: React.ReactNode;
  config: T;
  onSubmit?: (
    value: InferFormData<T>,
    data: InferFormState<T>
  ) => Promise<void> | void;
  onChange?: () => Promise<void> | void;
  initialValues?: InferFormState<T>;
}) {
  const parentFragment = useContext(FormFragmentContext);

  const initialValuesMap = useMemo(() => {
    if (!initialValues) {
      return parentFragment?.initialValues;
    }

    const initialValuesMap = getInitialValues(
      initialValues as Record<string, JsonValue>,
      config
    );

    if (parentFragment?.initialValues) {
      return mergeMaps(parentFragment.initialValues, initialValuesMap);
    }

    return initialValuesMap;
  }, [parentFragment, initialValues, config]);

  const { cache, errors } = useMemo(
    () =>
      parentFragment ?? {
        errors: createEventBus<FormError<string | null>>(),
        cache: createValidationCache(),
      },
    [parentFragment]
  );

  const context = useMemo(
    () => ({
      cache,
      errors,
      fieldData: parentFragment?.fieldData ?? getFieldData(config),
      initialValues: initialValuesMap,
    }),
    [parentFragment, config, cache, errors, initialValuesMap]
  );

  return (
    <FormFragmentContext.Provider value={context}>
      <FormSubmitPlugin config={config} onSubmit={onSubmit} />
      <FormChangePlugin onChange={onChange} />
      {children}
    </FormFragmentContext.Provider>
  );
}
