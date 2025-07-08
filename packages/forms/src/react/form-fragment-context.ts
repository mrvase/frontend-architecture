import { createContext } from "react";
import type { EmitterContext } from "../core/emitter";

export const FormFragmentContext = createContext<EmitterContext | null>(null);
