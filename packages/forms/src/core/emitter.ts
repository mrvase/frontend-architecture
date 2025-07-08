import {
  type FormError,
  type FormInterrupt,
  silenceError,
  type FieldConfig,
  resetError,
  type JsonValue,
  isError,
  type FieldType,
} from "../types";
import type { EventBus } from "../utils/event-bus";
import {
  type FieldData,
  type FieldDataMap,
  getNameByReverseIndex,
} from "./field-data";
import type { InitialValuesMap } from "./initial-values";
import type { ValidationCache } from "./validate";

export type EmitterContext = {
  cache: ValidationCache;
  errors: EventBus<FormError<string | null>>;
  fieldData: FieldDataMap;
  initialValues: InitialValuesMap | undefined;
};

export const createValidationEmitter = (context: EmitterContext) => {
  const resetFragmentErrors = (
    field: FieldConfig<FieldType, any>,
    data: FieldData
  ) => {
    data.fragments.forEach((fragmentConfig, index) => {
      const name = getNameByReverseIndex(data.name, index);
      const current = context.cache.getCurrentValue(fragmentConfig, name);
      if (!isError(current) || !current.subscriptions.includes(field)) {
        return;
      }
      // In the mean time, a child field might have become invalid.
      // If so, we do not want to reset the child field error.
      // If a child field is invalid, we do not get a fragment value.
      const value = context.cache.buildFragmentValue(fragmentConfig, name);
      if (!value) {
        return;
      }
      context.errors.dispatch(resetError(current));
    });
  };

  const validateField = async (
    formData: FormData,
    field: FieldConfig<any, any>,
    silent?: boolean
  ) => {
    const data = context.fieldData.get(field);

    if (!data) {
      throw new Error("Invalid field");
    }

    resetFragmentErrors(field, data);

    const value = formData.get(data.name) as JsonValue;

    const handleError = (result: FormError | FormInterrupt | undefined) => {
      if (isError(result)) {
        const error = silent ? silenceError(result) : result;
        context.errors.dispatch(error);
      }
      return result;
    };

    context.cache.validate(value, field, data).then(handleError);
  };

  return validateField;
};
