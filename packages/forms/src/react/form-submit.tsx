import { useContext, useLayoutEffect } from "react";
import { getFieldData } from "../core/field-data";
import {
  FragmentConfig,
  InferType,
  FieldConfig,
  JsonValue,
  isInterrupt,
  isError,
  InferData,
  isFieldConfig,
} from "../types";
import { FormBoundaryContext, SubmitHandler } from "./form-boundary";
import { FormFragmentContext } from "./form-fragment-context";

export function FormSubmitPlugin<T extends FragmentConfig<any, any>>({
  config,
  onSubmit,
}: {
  config: T;
  onSubmit?: (value: InferType<T>, data: InferData<T>) => void;
}) {
  const formCtx = useContext(FormBoundaryContext);
  const fragmentCtx = useContext(FormFragmentContext)!;

  if (!formCtx || !fragmentCtx) {
    throw new Error(
      "FormSubmitPlugin must be used within a FormBoundary and a FormFragment"
    );
  }

  const { registerSubmitHandler } = formCtx;
  const { fieldData, errors, cache } = fragmentCtx;

  useLayoutEffect(() => {
    const baseName = fieldData.get(config)?.name;

    if (baseName === undefined) {
      throw new Error("Invalid config");
    }

    const validateField = async (
      formData: FormData,
      field: FieldConfig<any, any>
    ) => {
      const data = fieldData.get(field);
      if (!data) throw new Error("Invalid field");

      return cache.validate(formData.get(data.name) as JsonValue, field, data);
    };

    const submitHandler: SubmitHandler = async (data) => {
      const configs = Array.from(getFieldData(config).keys()).filter(
        isFieldConfig
      );
      const results = await Promise.all(
        Array.from(configs, (field) => validateField(data, field))
      );

      let hasErrorOrInterrupt = false;

      results.forEach((result) => {
        if (isError(result)) {
          hasErrorOrInterrupt = true;
          errors.dispatch(result);
        }
        if (isInterrupt(result)) {
          hasErrorOrInterrupt = true;
        }
      });

      if (hasErrorOrInterrupt) {
        return {
          type: "error",
        };
      }

      const fragmentData = cache.buildFragmentData(config, baseName);
      const fragmentValue = cache.getCurrentValue(config, baseName);

      if (
        fragmentValue instanceof Promise ||
        isError(fragmentValue) ||
        isInterrupt(fragmentValue) ||
        fragmentValue === undefined
      ) {
        throw new Error("Invalid config");
      }

      return {
        type: "success",
        submit: () =>
          onSubmit?.(
            fragmentValue as InferType<T>,
            fragmentData as InferData<T>
          ),
      };
    };

    return registerSubmitHandler(submitHandler);
  }, [registerSubmitHandler, config, onSubmit]);

  return null;
}
