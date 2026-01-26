import { execa } from "execa";
import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";

export interface AssetUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a file to GitHub as a release asset.
 * Creates a hidden release for storing PR assets if needed.
 */
export async function uploadAsset(filePath: string): Promise<AssetUploadResult> {
  if (!existsSync(filePath)) {
    return { success: false, error: "File not found" };
  }

  const stats = statSync(filePath);
  if (stats.size === 0) {
    return { success: false, error: "File is empty" };
  }

  try {
    // Get or create the assets release
    const releaseTag = await getOrCreateAssetsRelease();
    if (!releaseTag) {
      return { success: false, error: "Failed to create assets release" };
    }

    const originalName = basename(filePath);

    // Upload the asset
    const { stdout, exitCode } = await execa(
      "gh",
      ["release", "upload", releaseTag, filePath, "--clobber"],
      { reject: false }
    );

    if (exitCode !== 0) {
      return { success: false, error: `Upload failed: ${stdout}` };
    }

    // Get the asset URL
    const assetUrl = await getAssetUrl(releaseTag, originalName);
    if (!assetUrl) {
      return { success: false, error: "Failed to get asset URL" };
    }

    return { success: true, url: assetUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

const ASSETS_RELEASE_TAG = "gent-assets";
const ASSETS_RELEASE_NAME = "Gent PR Assets";

/**
 * Get or create a hidden release for storing PR assets
 */
async function getOrCreateAssetsRelease(): Promise<string | null> {
  try {
    // Check if release exists
    const { exitCode } = await execa(
      "gh",
      ["release", "view", ASSETS_RELEASE_TAG],
      { reject: false }
    );

    if (exitCode === 0) {
      return ASSETS_RELEASE_TAG;
    }

    // Create the release
    const { exitCode: createCode } = await execa(
      "gh",
      [
        "release",
        "create",
        ASSETS_RELEASE_TAG,
        "--title",
        ASSETS_RELEASE_NAME,
        "--notes",
        "Auto-generated release for storing PR video assets. Do not delete.",
        "--prerelease",
      ],
      { reject: false }
    );

    if (createCode === 0) {
      return ASSETS_RELEASE_TAG;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get the download URL for an uploaded asset
 */
async function getAssetUrl(
  releaseTag: string,
  filename: string
): Promise<string | null> {
  try {
    const { stdout } = await execa("gh", [
      "release",
      "view",
      releaseTag,
      "--json",
      "assets",
    ]);

    const data = JSON.parse(stdout);
    const asset = data.assets?.find(
      (a: { name: string; url: string }) => a.name === filename
    );

    return asset?.url || null;
  } catch {
    return null;
  }
}

/**
 * Format video URL for markdown embedding in PR description
 */
export function formatVideoMarkdown(url: string, title: string = "Demo Video"): string {
  // GitHub markdown supports video embedding with a specific format
  return `
## ${title}

https://github.com/user-attachments/assets/${url.split("/").pop()}

<video src="${url}" controls width="100%"></video>
`;
}
