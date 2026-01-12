import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NPM_REGISTRY_URL = "https://registry.npmjs.org/@rotorsoft/gent/latest";
const CACHE_DIR = join(homedir(), ".gent");
const CACHE_FILE = join(CACHE_DIR, "version-check.json");
const DEFAULT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 3000; // 3 seconds

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: number | null;
}

interface VersionCache {
  latestVersion: string;
  checkedAt: number;
}

/**
 * Reads the version from package.json
 */
export function getVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../../package.json"), "utf8")
  );
  return packageJson.version;
}

/**
 * Compares two semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const [main] = v.split("-"); // Ignore pre-release suffix
    return main.split(".").map((n) => parseInt(n, 10));
  };

  const aParts = parseVersion(a);
  const bParts = parseVersion(b);

  for (let i = 0; i < 3; i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  return 0;
}

/**
 * Reads cached version check result
 */
function readCache(): VersionCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const content = readFileSync(CACHE_FILE, "utf8");
    return JSON.parse(content) as VersionCache;
  } catch {
    return null;
  }
}

/**
 * Writes version check result to cache
 */
function writeCache(cache: VersionCache): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache), "utf8");
  } catch {
    // Silently ignore cache write errors
  }
}

/**
 * Fetches the latest version from npm registry
 */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(NPM_REGISTRY_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = (await response.json()) as { version?: string };
    return data.version || null;
  } catch {
    // Network error, timeout, or parse error - fail silently
    return null;
  }
}

/**
 * Checks if a newer version is available
 * Uses caching to avoid excessive API calls
 */
export async function checkForUpdates(
  checkIntervalMs: number = DEFAULT_CHECK_INTERVAL_MS
): Promise<VersionCheckResult> {
  const currentVersion = getVersion();
  const cache = readCache();
  const now = Date.now();

  // Use cached result if still valid
  if (cache && now - cache.checkedAt < checkIntervalMs) {
    const updateAvailable = compareVersions(cache.latestVersion, currentVersion) > 0;
    return {
      currentVersion,
      latestVersion: cache.latestVersion,
      updateAvailable,
      lastChecked: cache.checkedAt,
    };
  }

  // Fetch fresh version from npm
  const latestVersion = await fetchLatestVersion();

  if (latestVersion) {
    writeCache({ latestVersion, checkedAt: now });
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      lastChecked: now,
    };
  }

  // Fetch failed, return cached or unknown state
  return {
    currentVersion,
    latestVersion: cache?.latestVersion || null,
    updateAvailable: cache ? compareVersions(cache.latestVersion, currentVersion) > 0 : false,
    lastChecked: cache?.checkedAt || null,
  };
}

/**
 * Formats the upgrade notification message
 */
export function formatUpgradeNotification(
  currentVersion: string,
  latestVersion: string
): string {
  return `Update available: ${currentVersion} → ${latestVersion}\nRun: npm install -g @rotorsoft/gent`;
}
