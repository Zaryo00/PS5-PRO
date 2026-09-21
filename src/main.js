// PS5-PRO — Application entry point (ES Module bootstrap only)

import { startApp } from "./app.js";

const REQUIRED_ROOT_SELECTORS = ["#app"];
const OPTIONAL_ROOT_SELECTORS = ["#boot-screen", "#main-interface", "#error-layer"];

const ERROR_LAYER_ID = "error-layer";
const ERROR_LAYER_ACTIVE_CLASS = "is-active";
const ERROR_LAYER_HIDDEN_CLASS = "is-hidden";

let hasBootstrapped = false;
let hasBootstrappedSuccessfully = false;

/**
 * Verifies that the minimal required DOM roots exist.
 * Returns the resolved root element or null when unavailable.
 */
function resolveAppRoot() {
  for (const selector of REQUIRED_ROOT_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

/**
 * Best-effort check that optional UI layers referenced by main.js exist.
 * Does not create or mutate DOM structure.
 */
function hasOptionalLayer(id) {
  return Boolean(document.getElementById(id));
}

/**
 * Attempts to surface a startup failure through the error layer when present.
 * Purely defensive: never throws if the layer is missing or malformed.
 */
function showStartupError(error) {
  const errorLayer = hasOptionalLayer(ERROR_LAYER_ID)
    ? document.getElementById(ERROR_LAYER_ID)
    : null;

  if (!errorLayer) {
    return;
  }

  try {
    errorLayer.classList.remove(ERROR_LAYER_HIDDEN_CLASS);
    errorLayer.classList.add(ERROR_LAYER_ACTIVE_CLASS);
    errorLayer.setAttribute("aria-hidden", "false");

    const messageNode = errorLayer.querySelector('[data-role="error-message"]');
    if (messageNode) {
      const detail =
        error && typeof error.message === "string" && error.message.length > 0
          ? error.message
          : "Uygulama başlatılamadı.";
      messageNode.textContent = detail;
    }
  } catch {
    // Error layer rendering must never mask the original failure.
  }
}

/**
 * Guards against duplicate initialization of the application.
 */
function shouldSkipBootstrap() {
  if (hasBootstrapped) {
    return true;
  }
  hasBootstrapped = true;
  return false;
}

/**
 * Runs the application startup sequence exactly once.
 */
async function bootstrap() {
  if (shouldSkipBootstrap()) {
    return;
  }

  const appRoot = resolveAppRoot();
  if (!appRoot) {
    const rootError = new Error(
      "Uygulama kök elemanı bulunamadı (#app)."
    );
    console.error("[main] Startup aborted:", rootError);
    showStartupError(rootError);
    return;
  }

  try {
    await startApp({
      root: appRoot,
      hasBootScreen: hasOptionalLayer("boot-screen"),
      hasMainInterface: hasOptionalLayer("main-interface"),
      hasErrorLayer: hasOptionalLayer(ERROR_LAYER_ID)
    });

    hasBootstrappedSuccessfully = true;
  } catch (error) {
    hasBootstrappedSuccessfully = false;
    console.error("[main] Application failed to start:", error);
    showStartupError(error);
  }
}

// Module scripts execute after DOM parsing; still guard defensively.
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void bootstrap();
    },
    { once: true }
  );
} else {
  void bootstrap();
}

// Read-only introspection for diagnostics; not part of the public app state.
export function isAppBootstrapped() {
  return hasBootstrappedSuccessfully;
    }
