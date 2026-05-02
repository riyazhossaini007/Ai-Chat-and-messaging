import type { NavigateFunction, NavigateOptions, To } from "react-router-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => { finished: Promise<void> };
};

export function navigateWithTransition(
  navigate: NavigateFunction,
  to: To,
  options?: NavigateOptions
) {
  const run = () => navigate(to, options);
  if (typeof document === "undefined") {
    run();
    return;
  }

  const viewTransitionDoc = document as ViewTransitionDocument;
  if (typeof viewTransitionDoc.startViewTransition === "function") {
    viewTransitionDoc.startViewTransition(run);
    return;
  }

  run();
}

export function goHomeWithTransition(navigate: NavigateFunction, options?: NavigateOptions) {
  navigateWithTransition(navigate, "/home", options);
}
