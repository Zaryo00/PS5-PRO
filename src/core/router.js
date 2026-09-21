// PS5-PRO — Core router
// Responsibilities: screen registration, navigation, history, lifecycle events.
// Does not render UI, does not manage overlays, does not launch games.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const KNOWN_SCREENS = Object.freeze([
  "home",
  "library",
  "store",
  "game-details",
  "search",
  "settings"
]);

const CSS_STATE = Object.freeze({
  ACTIVE: "is-active",
  HIDDEN: "is-hidden",
  VISIBLE: "is-visible"
});

const DOM_IDS = Object.freeze({
  APP: "app",
  CONTENT: "content"
});

const DEFAULT_SCREEN = "home";
const ROUTER_EVENT_NAME = "screenchange";

const HISTORY_LIMIT = 50;

// ---------------------------------------------------------------------------
// Module-scoped state
// ---------------------------------------------------------------------------
let isInitialized = false;
let isDestroyed = false;

const routes = new Map(); // screenId -> HTMLElement
const history = []; // array of screenId

let currentScreen = null;
let previousScreen = null;

let contentRoot = null;
let appRoot = null;

const boundHandlers = {
  hashchange: null
};

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------
function isKnownScreen(screenId) {
  return typeof screenId === "string" && KNOWN_SCREENS.includes(screenId);
}

function isValidScreenId(screenId) {
  return typeof screenId === "string" && screenId.length > 0;
}

function resolveScreenElement(screenId) {
  if (routes.has(screenId)) {
    const registered = routes.get(screenId);
    if (registered && registered.isConnected) {
      return registered;
    }
  }
  if (!contentRoot) {
    return null;
  }
  return contentRoot.querySelector(`[data-screen="${screenId}"]`);
}

function applyScreenVisibility(element, visible) {
  if (!element) {
    return;
  }
  if (visible) {
    element.classList.remove(CSS_STATE.HIDDEN);
    element.classList.add(CSS_STATE.ACTIVE, CSS_STATE.VISIBLE);
    element.removeAttribute("hidden");
    element.setAttribute("aria-hidden", "false");
  } else {
    element.classList.remove(CSS_STATE.ACTIVE, CSS_STATE.VISIBLE);
    element.classList.add(CSS_STATE.HIDDEN);
    element.setAttribute("aria-hidden", "true");
  }
}

function dispatchScreenChange(from, to) {
  if (from === to) {
    return;
  }
  try {
    const event = new CustomEvent(ROUTER_EVENT_NAME, {
      detail: Object.freeze({ from, to })
    });
    window.dispatchEvent(event);
  } catch {
    // CustomEvent unsupported environments: silently skip.
  }
}

function syncHash(screenId) {
  if (typeof window === "undefined" || !window.location) {
    return;
  }
  const targetHash = `#${screenId}`;
  if (window.location.hash !== targetHash) {
    try {
      window.history.replaceState(null, "", targetHash);
    } catch {
      // history API unavailable: fallback to direct assignment.
      window.location.hash = screenId;
    }
  }
}

function readHashScreen() {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }
  const raw = window.location.hash.replace(/^#/, "").trim();
  return isValidScreenId(raw) ? raw : null;
}

function pushHistory(screenId) {
  if (history.length > 0 && history[history.length - 1] === screenId) {
    return;
  }
  history.push(screenId);
  if (history.length > HISTORY_LIMIT) {
    history.shift();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initializes the router.
 * Binds DOM roots, resolves initial screen, and wires hashchange listener.
 *
 * @param {Object} [options]
 * @param {HTMLElement} [options.contentRoot] — optional explicit content container
 * @param {HTMLElement} [options.appRoot] — optional explicit app container
 * @param {string} [options.initialScreen] — optional initial screen id
 * @param {boolean} [options.syncHash=true] — whether to sync URL hash
 * @returns {boolean} true when initialized, false when already initialized
 */
export function initRouter(options = {}) {
  if (isInitialized) {
    return false;
  }

  appRoot =
    options.appRoot ||
    (typeof document !== "undefined" ? document.getElementById(DOM_IDS.APP) : null);

  contentRoot =
    options.contentRoot ||
    (typeof document !== "undefined" ? document.getElementById(DOM_IDS.CONTENT) : null);

  if (!contentRoot) {
    // Router remains safe to call; navigation becomes a no-op with warning.
    isInitialized = true;
    isDestroyed = false;
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[router] Content root not found. Navigation disabled.");
    }
    return true;
  }

  // Pre-register routes found in DOM.
  const discovered = contentRoot.querySelectorAll("[data-screen]");
  discovered.forEach((element) => {
    const screenId = element.getAttribute("data-screen");
    if (isValidScreenId(screenId)) {
      routes.set(screenId, element);
    }
  });

  isInitialized = true;
  isDestroyed = false;

  // Determine initial screen.
  const hashScreen = readHashScreen();
  const requested = options.initialScreen;
  const initial =
    (isValidScreenId(requested) && resolveScreenElement(requested) && requested) ||
    (hashScreen && resolveScreenElement(hashScreen) && hashScreen) ||
    DEFAULT_SCREEN;

  // Force-activate initial screen without history duplication.
  activateScreen(initial, { record: true, syncHash: options.syncHash !== false });

  // Wire hashchange listener for optional hash-based routing.
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    boundHandlers.hashchange = () => {
      const target = readHashScreen();
      if (!target) {
        return;
      }
      if (target === currentScreen) {
        return;
      }
      if (!resolveScreenElement(target)) {
        return;
      }
      navigateTo(target, { record: true, syncHash: false });
    };
    window.addEventListener("hashchange", boundHandlers.hashchange);
  }

  return true;
}

/**
 * Internal activation routine shared by init and navigateTo.
 */
function activateScreen(screenId, { record = true, syncHash: shouldSync = true } = {}) {
  const target = resolveScreenElement(screenId);
  if (!target) {
    return false;
  }

  if (currentScreen === screenId) {
    return true;
  }

  const from = currentScreen;

  // Deactivate current.
  if (from) {
    const currentElement = resolveScreenElement(from);
    applyScreenVisibility(currentElement, false);
  }

  // Activate next.
  applyScreenVisibility(target, true);

  previousScreen = from || null;
  currentScreen = screenId;

  if (record) {
    pushHistory(screenId);
  }

  if (shouldSync) {
    syncHash(screenId);
  }

  dispatchScreenChange(from, screenId);
  return true;
}

/**
 * Navigates to a registered screen.
 *
 * @param {string} screenId
 * @param {Object} [options]
 * @param {boolean} [options.record=true] — push to history
 * @param {boolean} [options.syncHash=true] — update URL hash
 * @param {boolean} [options.silent=false] — suppress console warnings on failure
 * @returns {boolean} true when navigation succeeded
 */
export function navigateTo(screenId, options = {}) {
  if (!isInitialized || isDestroyed) {
    if (!options.silent && typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[router] navigateTo called before initRouter().");
    }
    return false;
  }

  if (!isValidScreenId(screenId)) {
    if (!options.silent && typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[router] Invalid screen id:", screenId);
    }
    return false;
  }

  if (screenId === currentScreen) {
    return true;
  }

  const target = resolveScreenElement(screenId);
  if (!target) {
    if (!options.silent && typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[router] Screen element not found:", screenId);
    }
    return false;
  }

  return activateScreen(screenId, {
    record: options.record !== false,
    syncHash: options.syncHash !== false
  });
}

/**
 * @returns {string|null} currently active screen id
 */
export function getCurrentScreen() {
  return currentScreen;
}

/**
 * @returns {string|null} previous screen id
 */
export function getPreviousScreen() {
  return previousScreen;
}

/**
 * Navigates back through the history stack.
 * Falls back to the default screen when history is empty.
 *
 * @returns {boolean} true when navigation succeeded
 */
export function goBack() {
  if (!isInitialized || isDestroyed) {
    return false;
  }

  // Remove current entry, then read the last remaining entry.
  if (history.length > 0 && history[history.length - 1] === currentScreen) {
    history.pop();
  }

  const target = history.length > 0 ? history[history.length - 1] : DEFAULT_SCREEN;

  if (target === currentScreen) {
    return true;
  }

  if (!resolveScreenElement(target)) {
    // Target no longer exists: retry one level up or fall back to default.
    history.pop();
    if (history.length > 0) {
      return goBack();
    }
    return navigateTo(DEFAULT_SCREEN, { record: true });
  }

  // Activate without pushing to history (history already popped).
  return activateScreen(target, { record: false, syncHash: true });
}

/**
 * Registers a screen element explicitly.
 *
 * @param {string} screenId
 * @param {HTMLElement} element
 * @returns {boolean} true when registered
 */
export function registerRoute(screenId, element) {
  if (!isValidScreenId(screenId)) {
    return false;
  }
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  routes.set(screenId, element);
  return true;
}

/**
 * Unregisters a screen.
 * If the removed screen was active, falls back to the default screen.
 *
 * @param {string} screenId
 * @returns {boolean} true when removed
 */
export function unregisterRoute(screenId) {
  if (!isValidScreenId(screenId)) {
    return false;
  }
  const removed = routes.delete(screenId);
  if (removed && currentScreen === screenId) {
    currentScreen = null;
    navigateTo(DEFAULT_SCREEN, { record: true });
  }
  return removed;
}

/**
 * Tears down the router: clears listeners, resets state, empties routes.
 * Safe to call multiple times.
 */
export function destroyRouter() {
  if (isDestroyed) {
    return;
  }

  if (
    boundHandlers.hashchange &&
    typeof window !== "undefined" &&
    typeof window.removeEventListener === "function"
  ) {
    window.removeEventListener("hashchange", boundHandlers.hashchange);
  }
  boundHandlers.hashchange = null;

  routes.clear();
  history.length = 0;

  currentScreen = null;
  previousScreen = null;
  contentRoot = null;
  appRoot = null;

  isInitialized = false;
  isDestroyed = true;
                       }
