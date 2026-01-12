import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Reads the version from package.json
 */
export function getVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../../package.json"), "utf8")
  );
  return packageJson.version;
}
