import { AsyncLocalStorage } from "node:async_hooks";
import { installLocaleAls, type UiLocale } from "./locale";

// Side-effect import from middleware / tests only — never from client components.
installLocaleAls(new AsyncLocalStorage<UiLocale>());
