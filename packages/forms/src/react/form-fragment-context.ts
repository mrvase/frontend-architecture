import { createContext } from "react";
import { EmitterContext } from "../core/emitter";

export const FormFragmentContext = createContext<EmitterContext | null>(null);
