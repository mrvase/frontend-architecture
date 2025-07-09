import {
  useState,
  useContext,
  useLayoutEffect,
  useMemo,
  useCallback,
  type SyntheticEvent,
} from "react";
import type { FieldConfig, FieldType, FieldTypes } from "../types";
import { FormFragmentContext } from "./form-fragment-context";
import { createValidationEmitter } from "../core/emitter";

export const useField = <T extends FieldType>(config: FieldConfig<T, any>) => {
  const [error, setError] = useState<string | null>(null);

  const context = useContext(FormFragmentContext);

  if (!context) {
    throw new Error("useField must be used within a FormFragment");
  }

  useLayoutEffect(() => {
    return context.errors.registerHandler((error) => {
      if (!error.subscriptions.includes(config) || error.silent) {
        return;
      }
      setError(error.message);
    });
  }, [context, config]);

  const name = useMemo(() => {
    const name = context.fieldData.get(config)?.name;
    if (!name) {
      throw new Error("Field does not exist in config");
    }
    return name;
  }, [context, config]);

  const initialValue = useMemo(() => {
    return (context.initialValues?.get(config) ?? undefined) as
      | Exclude<FieldTypes[T], null>
      | undefined;
  }, [context, config]);

  const emitValidation = useMemo(
    () => createValidationEmitter(context),
    [context]
  );

  const getFormData = useCallback((target: HTMLElement) => {
    const form = target.closest("form");
    if (!form) {
      throw new Error("useField must be used within a FormBoundary");
    }
    return new FormData(form);
  }, []);

  const trigger = useCallback(
    (ev: Event | SyntheticEvent, silent?: boolean) => {
      setError(null);
      const target = ev.currentTarget;
      if (!(target instanceof HTMLElement)) {
        throw new Error(
          "`trigger` must be called on an HTMLElement event handler"
        );
      }

      const data = getFormData(target);

      emitValidation(data, config, silent);
    },
    [context, config, emitValidation]
  );

  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (el) {
        const data = getFormData(el);
        emitValidation(data, config, true);
      }
    },
    [emitValidation]
  );

  return {
    ref,
    name,
    initialValue,
    error,
    trigger,
    triggerSilent: useCallback(
      (ev: Event | SyntheticEvent) => {
        trigger(ev, true);
      },
      [trigger]
    ),
  };
};
