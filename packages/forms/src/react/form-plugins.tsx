import { useContext, useLayoutEffect } from "react";
import { getFieldData } from "../core/field-data";
import {
  type FragmentConfig,
  type InferFormData,
  type FieldConfig,
  type JsonValue,
  isInterrupt,
  isError,
  type InferFormState,
  isFieldConfig,
} from "../types";
import {
  FormBoundaryContext,
  type ChangeHandler,
  type SubmitHandler,
} from "./form-boundary";
import { FormFragmentContext } from "./form-fragment-context";

export function FormSubmitPlugin<T extends FragmentConfig<any, any>>({
  config,
  onSubmit,
}: {
  config: T;
  onSubmit?: (
    value: InferFormData<T>,
    data: InferFormState<T>
  ) => Promise<void> | void;
}) {
  const formCtx = useContext(FormBoundaryContext);
  const fragmentCtx = useContext(FormFragmentContext);

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
            fragmentValue as InferFormData<T>,
            fragmentData as InferFormState<T>
          ),
      };
    };

    return registerSubmitHandler(submitHandler);
  }, [registerSubmitHandler, config, onSubmit]);

  return null;
}

export function FormChangePlugin({
  onChange,
}: {
  onChange?: () => Promise<void> | void;
}) {
  const formCtx = useContext(FormBoundaryContext);

  if (!formCtx) {
    throw new Error(
      "FormSubmitPlugin must be used within a FormBoundary and a FormFragment"
    );
  }

  const { registerChangeHandler } = formCtx;

  useLayoutEffect(() => {
    if (!onChange) {
      return;
    }

    const changeHandler: ChangeHandler = async () => {
      onChange?.();
    };

    return registerChangeHandler(changeHandler);
  }, [registerChangeHandler, onChange]);

  return null;
}
