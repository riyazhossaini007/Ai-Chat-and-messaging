import type { StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

const isDev = import.meta.env.DEV;

export const withDevtools = <T>(
  initializer: StateCreator<T, [], []>,
  name: string
): StateCreator<T, [], []> =>
  (isDev ? devtools(initializer, { name }) : initializer) as StateCreator<T, [], []>;
