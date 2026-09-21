// PS5-PRO — Persistent storage layer
// Wraps localStorage with safe serialization, memory fallback, and namespaced keys.
// Must not depend on state.js (no circular imports).

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const NAMESPACE = "ps5pro";
const STORAGE_VERSION = 1;

const STORAGE_KEYS = Object.freeze({
  settings: `${NAMESPACE}.settings`,
  profile: `${NAMESPACE}.profile`,
  games: `${NAMESPACE}.games`,
  notifications: `${NAMESPACE}.notifications`,
  preferences: `${NAMESPACE}.preferences`,
  metadata: `${NAMESPACE}.metadata`
});

const KNOWN_STORAGE_KEYS = Object.freeze(Object.values(STORAGE_KEYS));
const AVAILABILITY_TEST_KEY = `${NAMESPACE}__availability_test__`;

// ---------------------------------------------------------------------------
// Module-scoped state
// ---------------------------------------------------------------------------
const memoryStore = new Map();
let isInitialized = false;
let storageAvailable = false;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through to JSON-based clone
    }
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function serialize(value) {
  if (value === undefined) {
    return null;
  }
  try {
    const json = JSON.stringify(value);
    return json === undefined ? null : json;
  } catch {
    return null;
  }
}

function deserialize(raw, fallback) {
  if (typeof raw !== "string" || raw.length === 0) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
}

function warn(message) {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[storage] ${message}`);
  }
}

function normalizeKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    return null;
  }
  if (KNOWN_STORAGE_KEYS.includes(key)) {
    return key;
  }
  // Allow callers to pass short logical names (e.g. "settings").
  if (Object.prototype.hasOwnProperty.call(STORAGE_KEYS, key)) {
    return STORAGE_KEYS[key];
  }
  // Otherwise assume caller provided an already-namespaced key.
  if (key.startsWith(`${NAMESPACE}.`)) {
    return key;
  }
  return `${NAMESPACE}.${key}`;
}

// ---------------------------------------------------------------------------
// Backend abstraction (localStorage or memory fallback)
// ---------------------------------------------------------------------------
function probeLocalStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }
    window.localStorage.setItem(AVAILABILITY_TEST_KEY, "1");
    window.localStorage.removeItem(AVAILABILITY_TEST_KEY);
    return true;
  } catch {
    return false;
  }
}

function backendGet(key) {
  if (storageAvailable) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    }
  }
  return memoryStore.has(key) ? memoryStore.get(key) : null;
}

function backendSet(key, value) {
  if (storageAvailable) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      // Quota or access error: fall back to memory.
      memoryStore.set(key, value);
      return false;
    }
  }
  memoryStore.set(key, value);
  return true;
}

function backendRemove(key) {
  if (storageAvailable) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // fall through to memory cleanup
    }
  }
  memoryStore.delete(key);
}

function backendHas(key) {
  if (storageAvailable) {
    try {
      if (window.localStorage.getItem(key) !== null) {
        return true;
      }
    } catch {
      // fall through to memory check
    }
  }
  return memoryStore.has(key);
}

// ---------------------------------------------------------------------------
// Version / migration
// ---------------------------------------------------------------------------
function readMetadata() {
  const raw = backendGet(STORAGE_KEYS.metadata);
  const parsed = deserialize(raw, null);
  return isPlainObject(parsed) ? parsed : {};
}

function migrateStorage() {
  const metadata = readMetadata();
  const currentVersion = typeof metadata.version === "number" ? metadata.version : 0;

  if (currentVersion === STORAGE_VERSION) {
    return;
  }

  // Version 0 → 1: initialize metadata structure.
  if (currentVersion === 0) {
    const nextMetadata = { ...metadata, version: STORAGE_VERSION };
    backendSet(STORAGE_KEYS.metadata, serialize(nextMetadata));
    return;
  }

  // Future migrations can be chained here.
  const nextMetadata = { ...metadata, version: STORAGE_VERSION };
  backendSet(STORAGE_KEYS.metadata, serialize(nextMetadata));
}

// ---------------------------------------------------------------------------
// Public API — lifecycle
// ---------------------------------------------------------------------------
export function initStorage() {
  if (isInitialized) {
    return storageAvailable;
  }
  storageAvailable = probeLocalStorage();
  isInitialized = true;

  if (!storageAvailable) {
    warn("localStorage unavailable; using in-memory fallback.");
  }

  try {
    migrateStorage();
  } catch (error) {
    warn(`Migration failed: ${error && error.message ? error.message : "unknown error"}`);
  }

  return storageAvailable;
}

export function isStorageAvailable() {
  return storageAvailable;
}

// ---------------------------------------------------------------------------
// Public API — generic key/value
// ---------------------------------------------------------------------------
export function getItem(key, fallback = null) {
  const resolvedKey = normalizeKey(key);
  if (!resolvedKey) {
    return fallback;
  }
  const raw = backendGet(resolvedKey);
  if (raw === null || raw === undefined) {
    return fallback;
  }
  const parsed = deserialize(raw, undefined);
  if (parsed === undefined) {
    return fallback;
  }
  return safeClone(parsed);
}

export function setItem(key, value) {
  const resolvedKey = normalizeKey(key);
  if (!resolvedKey) {
    return false;
  }
  const serialized = serialize(value);
  if (serialized === null) {
    return false;
  }
  const stored = backendSet(resolvedKey, serialized);
  return stored;
}

export function removeItem(key) {
  const resolvedKey = normalizeKey(key);
  if (!resolvedKey) {
    return false;
  }
  backendRemove(resolvedKey);
  return true;
}

export function hasItem(key) {
  const resolvedKey = normalizeKey(key);
  if (!resolvedKey) {
    return false;
  }
  return backendHas(resolvedKey);
}

export function clearAll() {
  for (const fullKey of KNOWN_STORAGE_KEYS) {
    backendRemove(fullKey);
  }
  memoryStore.clear();
  return true;
}

export function getStorageSnapshot() {
  const snapshot = {};
  for (const [logicalName, fullKey] of Object.entries(STORAGE_KEYS)) {
    const raw = backendGet(fullKey);
    if (raw === null || raw === undefined) {
      snapshot[logicalName] = null;
      continue;
    }
    const parsed = deserialize(raw, null);
    snapshot[logicalName] = parsed === undefined ? null : safeClone(parsed);
  }
  return snapshot;
}

// ---------------------------------------------------------------------------
// Public API — settings
// ---------------------------------------------------------------------------
export function saveSettings(settings) {
  if (!isPlainObject(settings)) {
    return false;
  }
  return setItem(STORAGE_KEYS.settings, settings);
}

export function loadSettings(defaultSettings = {}) {
  const stored = getItem(STORAGE_KEYS.settings, null);
  if (!isPlainObject(stored)) {
    return isPlainObject(defaultSettings) ? safeClone(defaultSettings) : {};
  }
  return stored;
}

// ---------------------------------------------------------------------------
// Public API — profile
// ---------------------------------------------------------------------------
export function saveProfile(profile) {
  if (!isPlainObject(profile)) {
    return false;
  }
  return setItem(STORAGE_KEYS.profile, profile);
}

export function loadProfile(defaultProfile = null) {
  const stored = getItem(STORAGE_KEYS.profile, null);
  if (!isPlainObject(stored)) {
    return defaultProfile === null ? null : safeClone(defaultProfile);
  }
  return stored;
}

// ---------------------------------------------------------------------------
// Public API — game saves
// ---------------------------------------------------------------------------
function readGameContainer() {
  const stored = getItem(STORAGE_KEYS.games, null);
  if (!isPlainObject(stored)) {
    return {};
  }
  return stored;
}

function writeGameContainer(container) {
  if (!isPlainObject(container)) {
    return false;
  }
  return setItem(STORAGE_KEYS.games, container);
}

export function saveGameData(gameId, data) {
  if (typeof gameId !== "string" || gameId.length === 0) {
    return false;
  }
  if (data === undefined) {
    return false;
  }
  const container = readGameContainer();
  container[gameId] = safeClone(data);
  return writeGameContainer(container);
}

export function loadGameData(gameId, fallback = null) {
  if (typeof gameId !== "string" || gameId.length === 0) {
    return fallback;
  }
  const container = readGameContainer();
  if (!Object.prototype.hasOwnProperty.call(container, gameId)) {
    return fallback;
  }
  const value = container[gameId];
  if (value === undefined) {
    return fallback;
  }
  return safeClone(value);
}

export function removeGameData(gameId) {
  if (typeof gameId !== "string" || gameId.length === 0) {
    return false;
  }
  const container = readGameContainer();
  if (!Object.prototype.hasOwnProperty.call(container, gameId)) {
    return false;
  }
  delete container[gameId];
  writeGameContainer(container);
  return true;
}

export function getAllGameData() {
  const container = readGameContainer();
  return safeClone(container) ?? {};
}

// ---------------------------------------------------------------------------
// Public API — notifications
// ---------------------------------------------------------------------------
export function saveNotifications(notifications) {
  if (!Array.isArray(notifications) && !isPlainObject(notifications)) {
    return false;
  }
  return setItem(STORAGE_KEYS.notifications, notifications);
}

export function loadNotifications(fallback = []) {
  const stored = getItem(STORAGE_KEYS.notifications, null);
  if (Array.isArray(stored)) {
    return stored;
  }
  if (isPlainObject(stored)) {
    return stored;
  }
  if (Array.isArray(fallback)) {
    return fallback.slice();
  }
  if (isPlainObject(fallback)) {
    return safeClone(fallback);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Public API — preferences
// ---------------------------------------------------------------------------
export function savePreferences(preferences) {
  if (!isPlainObject(preferences)) {
    return false;
  }
  return setItem(STORAGE_KEYS.preferences, preferences);
}

export function loadPreferences(defaultPreferences = {}) {
  const stored = getItem(STORAGE_KEYS.preferences, null);
  if (!isPlainObject(stored)) {
    return isPlainObject(defaultPreferences) ? safeClone(defaultPreferences) : {};
  }
  return stored;
}

// ---------------------------------------------------------------------------
// Public API — metadata / version
// ---------------------------------------------------------------------------
export function saveMetadata(metadata) {
  if (!isPlainObject(metadata)) {
    return false;
  }
  return setItem(STORAGE_KEYS.metadata, metadata);
}

export function loadMetadata(fallback = {}) {
  const stored = getItem(STORAGE_KEYS.metadata, null);
  if (!isPlainObject(stored)) {
    return isPlainObject(fallback) ? safeClone(fallback) : {};
  }
  return stored;
}

export function getStorageVersion() {
  const metadata = readMetadata();
  if (typeof metadata.version === "number" && Number.isFinite(metadata.version)) {
    return metadata.version;
  }
  return 0;
}

export function setStorageVersion(version) {
  if (typeof version !== "number" || !Number.isFinite(version) || version < 0) {
    return false;
  }
  const metadata = readMetadata();
  metadata.version = Math.floor(version);
  return backendSet(STORAGE_KEYS.metadata, serialize(metadata));
}
