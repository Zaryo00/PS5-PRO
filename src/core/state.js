// PS5-PRO — Core state management
// Centralized, immutable-snapshot state container with subscription support.
// No DOM dependency; safe to import from any module.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATE_EVENT_NAME = "ps5statechange";
const DEFAULT_SOURCE = "unknown";

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------
export function createInitialState() {
  return {
    app: {
      initialized: false,
      bootCompleted: false,
      currentMode: "boot",
      isLoading: false,
      hasError: false
    },
    router: {
      currentScreen: "home",
      previousScreen: null,
      navigationHistory: []
    },
    profile: {
      id: "local-user",
      name: "Poyraz",
      avatar: null,
      online: true,
      status: "online"
    },
    controls: {
      controlCenterOpen: false,
      quickSettingsOpen: false,
      profileMenuOpen: false,
      notificationsOpen: false
    },
    game: {
      selectedGameId: null,
      runningGameId: null,
      isLaunching: false,
      isRunning: false,
      lastPlayedGameId: null
    },
    store: {
      selectedProductId: null,
      searchQuery: "",
      currentCategory: "all",
      isLoading: false
    },
    search: {
      query: "",
      isOpen: false,
      selectedResultIndex: 0
    },
    settings: {
      theme: "dark",
      language: "tr",
      soundEnabled: true,
      musicEnabled: true,
      notificationsEnabled: true,
      performanceMode: "standard",
      fullscreen: false
    },
    notifications: {
      unreadCount: 0,
      items: []
    },
    system: {
      online: true,
      controllerConnected: false,
      keyboardConnected: false,
      fullscreen: false,
      performanceMode: "standard"
    }
  };
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
let currentState = createInitialState();
const subscribers = new Set();
let isDestroyed = false;

// ---------------------------------------------------------------------------
// Cloning utilities
// ---------------------------------------------------------------------------
function safeClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through to manual clone
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => safeClone(item));
  }
  const result = {};
  for (const key of Object.keys(value)) {
    result[key] = safeClone(value[key]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Type guards for shallow validation of critical branches
// ---------------------------------------------------------------------------
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateStateBranch(branchKey, branchValue) {
  if (!isPlainObject(branchValue)) {
    return false;
  }

  switch (branchKey) {
    case "app": {
      const boolKeys = ["initialized", "bootCompleted", "isLoading", "hasError"];
      for (const key of boolKeys) {
        if (key in branchValue && typeof branchValue[key] !== "boolean") {
          return false;
        }
      }
      if ("currentMode" in branchValue && typeof branchValue.currentMode !== "string") {
        return false;
      }
      return true;
    }
    case "router": {
      if ("currentScreen" in branchValue && typeof branchValue.currentScreen !== "string") {
        return false;
      }
      if (
        "previousScreen" in branchValue &&
        branchValue.previousScreen !== null &&
        typeof branchValue.previousScreen !== "string"
      ) {
        return false;
      }
      if ("navigationHistory" in branchValue && !Array.isArray(branchValue.navigationHistory)) {
        return false;
      }
      return true;
    }
    case "profile": {
      if ("online" in branchValue && typeof branchValue.online !== "boolean") {
        return false;
      }
      return true;
    }
    case "controls": {
      const keys = [
        "controlCenterOpen",
        "quickSettingsOpen",
        "profileMenuOpen",
        "notificationsOpen"
      ];
      for (const key of keys) {
        if (key in branchValue && typeof branchValue[key] !== "boolean") {
          return false;
        }
      }
      return true;
    }
    case "game": {
      const nullableStringKeys = ["selectedGameId", "runningGameId", "lastPlayedGameId"];
      for (const key of nullableStringKeys) {
        if (
          key in branchValue &&
          branchValue[key] !== null &&
          typeof branchValue[key] !== "string"
        ) {
          return false;
        }
      }
      if ("isLaunching" in branchValue && typeof branchValue.isLaunching !== "boolean") {
        return false;
      }
      if ("isRunning" in branchValue && typeof branchValue.isRunning !== "boolean") {
        return false;
      }
      return true;
    }
    case "store": {
      if (
        "selectedProductId" in branchValue &&
        branchValue.selectedProductId !== null &&
        typeof branchValue.selectedProductId !== "string"
      ) {
        return false;
      }
      if ("searchQuery" in branchValue && typeof branchValue.searchQuery !== "string") {
        return false;
      }
      if ("currentCategory" in branchValue && typeof branchValue.currentCategory !== "string") {
        return false;
      }
      if ("isLoading" in branchValue && typeof branchValue.isLoading !== "boolean") {
        return false;
      }
      return true;
    }
    case "search": {
      if ("query" in branchValue && typeof branchValue.query !== "string") {
        return false;
      }
      if ("isOpen" in branchValue && typeof branchValue.isOpen !== "boolean") {
        return false;
      }
      if (
        "selectedResultIndex" in branchValue &&
        typeof branchValue.selectedResultIndex !== "number"
      ) {
        return false;
      }
      return true;
    }
    case "settings": {
      if ("theme" in branchValue && typeof branchValue.theme !== "string") {
        return false;
      }
      if ("language" in branchValue && typeof branchValue.language !== "string") {
        return false;
      }
      if ("performanceMode" in branchValue && typeof branchValue.performanceMode !== "string") {
        return false;
      }
      const boolKeys = [
        "soundEnabled",
        "musicEnabled",
        "notificationsEnabled",
        "fullscreen"
      ];
      for (const key of boolKeys) {
        if (key in branchValue && typeof branchValue[key] !== "boolean") {
          return false;
        }
      }
      return true;
    }
    case "notifications": {
      if ("unreadCount" in branchValue && typeof branchValue.unreadCount !== "number") {
        return false;
      }
      if ("items" in branchValue && !Array.isArray(branchValue.items)) {
        return false;
      }
      return true;
    }
    case "system": {
      const boolKeys = ["online", "controllerConnected", "keyboardConnected", "fullscreen"];
      for (const key of boolKeys) {
        if (key in branchValue && typeof branchValue[key] !== "boolean") {
          return false;
        }
      }
      if ("performanceMode" in branchValue && typeof branchValue.performanceMode !== "string") {
        return false;
      }
      return true;
    }
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Merge utilities
// ---------------------------------------------------------------------------
function mergeBranches(baseBranch, incomingBranch) {
  if (!isPlainObject(baseBranch) || !isPlainObject(incomingBranch)) {
    return safeClone(incomingBranch);
  }
  const result = { ...baseBranch };
  for (const key of Object.keys(incomingBranch)) {
    const incomingValue = incomingBranch[key];
    const baseValue = baseBranch[key];
    if (isPlainObject(incomingValue) && isPlainObject(baseValue)) {
      result[key] = mergeBranches(baseValue, incomingValue);
    } else {
      // Arrays and primitives replace entirely.
      result[key] = safeClone(incomingValue);
    }
  }
  return result;
}

function mergeState(baseState, patch) {
  if (!isPlainObject(patch)) {
    return baseState;
  }
  const result = { ...baseState };
  for (const key of Object.keys(patch)) {
    const incomingValue = patch[key];
    const baseValue = baseState[key];
    if (isPlainObject(incomingValue) && isPlainObject(baseValue)) {
      result[key] = mergeBranches(baseValue, incomingValue);
    } else if (incomingValue !== undefined) {
      result[key] = safeClone(incomingValue);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Deep equality for change detection
// ---------------------------------------------------------------------------
function isEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== "object") {
    return false;
  }
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) {
    return false;
  }
  if (aIsArray) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!isEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    if (!isEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------
function parsePath(path) {
  if (typeof path !== "string" || path.length === 0) {
    return null;
  }
  return path.split(".").filter((segment) => segment.length > 0);
}

function getValueAtPath(source, segments) {
  let cursor = source;
  for (const segment of segments) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }
    if (typeof cursor !== "object") {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function setValueAtPath(source, segments, value) {
  if (segments.length === 0) {
    return source;
  }
  const clone = safeClone(source);
  let cursor = clone;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!isPlainObject(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = safeClone(value);
  return clone;
}

function collectChangedPaths(previous, next, prefix = "") {
  const changed = [];
  if (previous === next) {
    return changed;
  }
  if (!isPlainObject(previous) || !isPlainObject(next)) {
    if (!isEqual(previous, next)) {
      changed.push(prefix || "/");
    }
    return changed;
  }
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const prevValue = previous[key];
    const nextValue = next[key];
    if (!isEqual(prevValue, nextValue)) {
      if (isPlainObject(prevValue) && isPlainObject(nextValue)) {
        const nested = collectChangedPaths(prevValue, nextValue, path);
        if (nested.length === 0) {
          changed.push(path);
        } else {
          for (const entry of nested) {
            changed.push(entry);
          }
        }
      } else {
        changed.push(path);
      }
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Notification pipeline
// ---------------------------------------------------------------------------
function notifySubscribers(previousState, nextState, changeInfo) {
  if (subscribers.size === 0) {
    return;
  }

  const snapshotPrev = safeClone(previousState);
  const snapshotNext = safeClone(nextState);

  for (const listener of Array.from(subscribers)) {
    if (!subscribers.has(listener)) {
      continue;
    }
    try {
      listener(snapshotNext, snapshotPrev, changeInfo);
    } catch (error) {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error("[state] Subscriber threw an error:", error);
      }
    }
  }
}

function dispatchStateEvent(nextState, previousState, changeInfo) {
  if (typeof document === "undefined" || typeof document.dispatchEvent !== "function") {
    return;
  }
  try {
    const event = new CustomEvent(STATE_EVENT_NAME, {
      detail: Object.freeze({
        nextState: safeClone(nextState),
        previousState: safeClone(previousState),
        changeInfo
      })
    });
    document.dispatchEvent(event);
  } catch {
    // CustomEvent unsupported: silently skip.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns an immutable snapshot of the current state.
 * Mutating the returned object does not affect the internal state.
 */
export function getState() {
  return safeClone(currentState);
}

/**
 * Updates the state via an object patch or updater function.
 * Object patches are deep-merged (arrays replaced, not merged).
 *
 * @param {Object|Function} updater
 * @param {Object} [options]
 * @param {string} [options.source="unknown"]
 * @returns {Object} the new state snapshot (or the previous one if no change)
 */
export function setState(updater, options = {}) {
  if (isDestroyed) {
    return getState();
  }

  let patch = null;
  if (typeof updater === "function") {
    try {
      patch = updater(safeClone(currentState));
    } catch (error) {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error("[state] Updater function threw an error:", error);
      }
      return getState();
    }
  } else if (isPlainObject(updater)) {
    patch = updater;
  } else {
    return getState();
  }

  if (!isPlainObject(patch)) {
    return getState();
  }

  // Validate critical branches.
  for (const key of Object.keys(patch)) {
    if (Object.prototype.hasOwnProperty.call(currentState, key)) {
      if (!validateStateBranch(key, { ...currentState[key], ...(isPlainObject(patch[key]) ? patch[key] : {}) })) {
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn(`[state] Rejected invalid patch for branch "${key}".`);
        }
        return getState();
      }
    }
  }

  const previousState = currentState;
  const nextState = mergeState(currentState, patch);

  if (isEqual(previousState, nextState)) {
    return getState();
  }

  currentState = nextState;

  const changeInfo = Object.freeze({
    source: typeof options.source === "string" && options.source.length > 0
      ? options.source
      : DEFAULT_SOURCE,
    changedPaths: Object.freeze(collectChangedPaths(previousState, nextState)),
    timestamp: Date.now()
  });

  notifySubscribers(previousState, nextState, changeInfo);
  dispatchStateEvent(nextState, previousState, changeInfo);

  return getState();
}

/**
 * Updates a single value identified by a dotted path.
 *
 * @param {string} path — e.g. "app.initialized" or "router.currentScreen"
 * @param {*} value
 * @param {Object} [options]
 * @returns {boolean} true when the update was applied
 */
export function updateState(path, value, options = {}) {
  const segments = parsePath(path);
  if (!segments) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[state] updateState called with invalid path:", path);
    }
    return false;
  }

  const topBranch = segments[0];
  if (!Object.prototype.hasOwnProperty.call(currentState, topBranch)) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn(`[state] Unknown top-level branch "${topBranch}".`);
    }
    return false;
  }

  const nextState = setValueAtPath(currentState, segments, value);
  const incomingBranch = nextState[topBranch];

  if (!validateStateBranch(topBranch, incomingBranch)) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn(`[state] Rejected invalid update for "${path}".`);
    }
    return false;
  }

  if (isEqual(currentState, nextState)) {
    return true;
  }

  const previousState = currentState;
  currentState = nextState;

  const changeInfo = Object.freeze({
    source: typeof options.source === "string" && options.source.length > 0
      ? options.source
      : "updateState",
    changedPaths: Object.freeze([segments.join(".")]),
    timestamp: Date.now()
  });

  notifySubscribers(previousState, nextState, changeInfo);
  dispatchStateEvent(nextState, previousState, changeInfo);

  return true;
}

/**
 * Reads a value from the current state using a dotted path.
 *
 * @param {string} path
 * @param {*} [fallback]
 * @returns {*} the value or fallback when not found
 */
export function getStateValue(path, fallback = undefined) {
  const segments = parsePath(path);
  if (!segments) {
    return fallback;
  }
  const value = getValueAtPath(currentState, segments);
  return value === undefined ? fallback : safeClone(value);
}

/**
 * Subscribes to state changes.
 *
 * @param {Function} listener — (nextState, previousState, changeInfo) => void
 * @returns {Function} unsubscribe
 */
export function subscribe(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  subscribers.add(listener);
  return function unsubscribe() {
    subscribers.delete(listener);
  };
}

/**
 * Resets the state to its initial shape.
 * Subscribers remain registered.
 */
export function resetState(options = {}) {
  const previousState = currentState;
  const nextState = createInitialState();

  if (isEqual(previousState, nextState)) {
    return getState();
  }

  currentState = nextState;

  const changeInfo = Object.freeze({
    source: typeof options.source === "string" && options.source.length > 0
      ? options.source
      : "resetState",
    changedPaths: Object.freeze(collectChangedPaths(previousState, nextState)),
    timestamp: Date.now()
  });

  notifySubscribers(previousState, nextState, changeInfo);
  dispatchStateEvent(nextState, previousState, changeInfo);

  return getState();
}

/**
 * Clears subscribers and marks the state module as destroyed.
 * Calling setState/resetState after destruction is a no-op.
 * A subsequent call to createInitialState() plus manual wiring restores usage.
 */
export function destroyState() {
  subscribers.clear();
  isDestroyed = true;
}

/**
 * Convenience accessor for whether the state module is currently destroyed.
 * Intended for diagnostics only.
 */
export function isStateDestroyed() {
  return isDestroyed;
}
