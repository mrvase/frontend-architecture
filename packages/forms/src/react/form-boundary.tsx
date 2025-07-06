import {
  createContext,
  FormEvent,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from "react";
import { createEventBus, EventBus } from "../utils/event-bus";

export type SubmitResult =
  | { type: "error" }
  | { type: "success"; submit: () => Promise<void> | void };

type SubmitEventBus = EventBus<FormData, Promise<SubmitResult>>;

export type SubmitHandler = Parameters<SubmitEventBus["registerHandler"]>[0];

export const FormBoundaryContext = createContext<{
  registerSubmitHandler: SubmitEventBus["registerHandler"];
  isPending: boolean;
} | null>(null);

const isAllSuccesses = (
  results: SubmitResult[]
): results is Extract<SubmitResult, { type: "success" }>[] => {
  return results.every((result) => result.type === "success");
};

export function FormBoundary({ children }: { children: React.ReactNode }) {
  const [isPending, startTransition] = useTransition();
  const submitters: SubmitEventBus = useMemo(() => createEventBus(), []);

  const handleSubmit = useCallback(async (ev: FormEvent<HTMLFormElement>) => {
    const form = ev.currentTarget;

    startTransition(async () => {
      ev.preventDefault();

      const results = await Promise.all(
        submitters.dispatch(new FormData(form))
      );

      if (!isAllSuccesses(results)) {
        return;
      }

      await Promise.all(results.map((el) => el.submit()));
    });
  }, []);

  const context = useMemo(
    () => ({
      isPending,
      registerSubmitHandler: submitters.registerHandler,
    }),
    [isPending, submitters]
  );

  return (
    <form onSubmit={handleSubmit}>
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
