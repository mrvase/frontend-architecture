import {
  createContext,
  type FormEvent,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { createEventBus, type EventBus } from "../utils/event-bus";

export type SubmitResult =
  | { type: "error" }
  | { type: "success"; submit: () => Promise<void> | void };

type SubmitEventBus = EventBus<FormData, Promise<SubmitResult>>;
type ChangeEventBus = EventBus<FormData, void>;

export type SubmitHandler = Parameters<SubmitEventBus["registerHandler"]>[0];
export type ChangeHandler = Parameters<ChangeEventBus["registerHandler"]>[0];

export const FormBoundaryContext = createContext<{
  registerSubmitHandler: SubmitEventBus["registerHandler"];
  registerChangeHandler: ChangeEventBus["registerHandler"];
  isPending: boolean;
} | null>(null);

const isAllSuccesses = (
  results: SubmitResult[]
): results is Extract<SubmitResult, { type: "success" }>[] => {
  return results.every((result) => result.type === "success");
};

export function FormBoundary({
  children,
  onSubmit,
  onChange,
  ...props
}: React.ComponentProps<"form">) {
  // const [isPending, startTransition] = useTransition();
  const [isPending, setIsPending] = useState(false);
  const submitEventBus: SubmitEventBus = useMemo(() => createEventBus(), []);
  const changeEventBus: ChangeEventBus = useMemo(() => createEventBus(), []);

  const handleSubmit = useCallback(
    async (ev: FormEvent<HTMLFormElement>) => {
      const form = ev.currentTarget;

      ev.preventDefault();
      setIsPending(true);

      try {
        const [_, ...results] = await Promise.all([
          onSubmit?.(ev),
          ...submitEventBus.dispatch(new FormData(form)),
        ]);

        if (!isAllSuccesses(results)) {
          return;
        }

        await Promise.all(results.map((el) => el.submit()));
      } finally {
        setIsPending(false);
      }
    },
    [submitEventBus, onSubmit]
  );

  const handleChange = useCallback(
    (ev: FormEvent<HTMLFormElement>) => {
      const form = ev.currentTarget;
      changeEventBus.dispatch(new FormData(form));
      onChange?.(ev);
    },
    [changeEventBus, onChange]
  );

  const context = useMemo(
    () => ({
      isPending,
      registerSubmitHandler: submitEventBus.registerHandler,
      registerChangeHandler: changeEventBus.registerHandler,
    }),
    [isPending, submitEventBus, changeEventBus]
  );

  return (
    <form onSubmit={handleSubmit} onChange={handleChange} {...props}>
      <FormBoundaryContext.Provider value={context}>
        {children}
      </FormBoundaryContext.Provider>
    </form>
  );
}

export const useFormStatus = () => {
  const form = useContext(FormBoundaryContext);
  return form?.isPending ?? false;
};
