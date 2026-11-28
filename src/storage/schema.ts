// The databases app keeps on the device, their stores and their versions. Every store has its
// keys out of its records; an index names the property of a record it reads.
import type { Schema } from "./backend.ts";

/** The device's settings: the language a grown-up chose. Only "Erase everything" erases it. */
export const SETTINGS = "novatrail-settings";
/** The device's registry: the account signed in, the sign-in project, and app's databases. */
export const REGISTRY = "novatrail-registry";
/** The shared cache of the open views of packages, by package digest. */
export const CACHE = "novatrail-cache";
/** Firebase Auth's own database, where it keeps the session. */
export const FIREBASE_AUTH = "firebaseLocalStorageDb";
/** The database of @firebase/app's heartbeats: its versions and the days it ran. */
export const FIREBASE_HEARTBEAT = "firebase-heartbeat-database";

const PROFILE = "novatrail-profile-";

/** The database of one learner's profile on the device. */
export function profileDatabase(profileId: string): string {
  return `${PROFILE}${profileId}`;
}

export const SETTINGS_SCHEMA: Schema = { version: 1, stores: { settings: {} } };

/**
 * `registry` holds `"account"` → `{ id }` and `"signIn"` → `{ projectId, apiKey }`, and `"ending"`
 * while an erasure of the account waits for a database it could not erase; `databases` holds app's
 * databases of the account by name, each named before it is first opened.
 */
export const REGISTRY_SCHEMA: Schema = { version: 1, stores: { registry: {}, databases: {} } };

/** `views` by `[digest, kind]`. */
export const CACHE_SCHEMA: Schema = {
  version: 1,
  stores: { views: { usedAt: "usedAt" } },
};

/**
 * `attempts` by attempt ID; `history` and `submissions` by `[attemptId, n]`, n from 0;
 * `correctWork`, which nothing writes and the start clears; `lessons` by lesson ID; since version
 * 2, `ownKey` holds the owner's own key under `"key"`, only while the adult keeps it on this
 * device; since version 4, the profile's history of pages from paper, kept until the profile is
 * erased: `pages` by page ID, a page's frames, `photos` by page ID, its photo, and `paperTasks`
 * by attempt ID, each task begun on a page with its crop and its work. Version 5 takes off the store
 * `essays` of versions 3 and 4, with every essay in it: an essay is an attempt's work like any
 * other.
 */
export const PROFILE_SCHEMA: Schema = {
  version: 5,
  stores: {
    attempts: { digest: "digest", changedAt: "changedAt" },
    history: {},
    submissions: {},
    correctWork: {},
    lessons: { digest: "digest", changedAt: "changedAt" },
    ownKey: {},
    pages: { takenAt: "takenAt" },
    photos: {},
    paperTasks: { page: "pageId" },
  },
};

/** The schema of one of app's databases by its name; none for a database not app's. */
export function schemaOf(name: string): Schema | undefined {
  if (name === SETTINGS) return SETTINGS_SCHEMA;
  if (name === REGISTRY) return REGISTRY_SCHEMA;
  if (name === CACHE) return CACHE_SCHEMA;
  return name.startsWith(PROFILE) ? PROFILE_SCHEMA : undefined;
}

/** How long work, a lesson and the cache keep untouched: 30 days. */
export const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
