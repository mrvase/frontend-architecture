import { useState, useContext, useMemo, useCallback, type SyntheticEvent } from "react";
import type { FieldConfig, FieldType, FieldTypes } from "../types";
import { FormFragmentContext } from "./form-fragment-context";
import { createValidationEmitter } from "../core/emitter";
import { SyncContext } from "./sync-context";
import { useLayoutEffect } from "../utils/use-layout-effect";

export const useField = <T extends FieldType>(config: FieldConfig<T>) => {
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const context = useContext(FormFragmentContext);
  const syncContext = useContext(SyncContext);

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
    () =>
      createValidationEmitter({
        ...context,
        syncContext: syncContext ?? undefined,
      }),
    [context, syncContext]
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
        throw new Error("`trigger` must be called on an HTMLElement event handler");
      }

      const data = getFormData(target);

      const t = setTimeout(() => {
        if (!silent) {
          setIsValidating(true);
        }
      }, 50);

      void emitValidation(data, config, silent).finally(() => {
        clearTimeout(t);
        setIsValidating(false);
      });
    },
    [context, config, emitValidation]
  );

  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (el) {
        const data = getFormData(el);
        void emitValidation(data, config, true);
      }
    },
    [emitValidation]
  );

  return {
    ref,
    name,
    initialValue,
    error,
    isValidating,
    trigger,
    triggerSilent: useCallback(
      (ev: Event | SyntheticEvent) => {
        trigger(ev, true);
      },
      [trigger]
    ),
  };
};
