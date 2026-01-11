import { spawn } from "child_process";
import { execa, type ResultPromise } from "execa";
import type { GentConfig, AIProvider } from "../types/index.js";
import { logger, colors } from "../utils/logger.js";

export interface AIProviderOptions {
  prompt: string;
  permissionMode?: string;
  printOutput?: boolean;
  streamOutput?: boolean;
}

export interface AIProviderResult {
  output: string;
  provider: AIProvider;
  rateLimited?: boolean;
}

/**
 * Invoke AI provider (non-interactive mode)
 * Returns output from the provider
 */
export async function invokeAI(
  options: AIProviderOptions,
  config: GentConfig,
  providerOverride?: AIProvider
): Promise<AIProviderResult> {
  const provider = providerOverride ?? config.ai.provider;

  try {
    const output = provider === "claude"
      ? await invokeClaudeInternal(options)
      : await invokeGeminiInternal(options);

    return { output, provider };
  } catch (error) {
    // Check for rate limiting
    if (isRateLimitError(error, provider)) {
      // Try fallback if configured
      if (config.ai.auto_fallback && config.ai.fallback_provider && !providerOverride) {
        const fallback = config.ai.fallback_provider;
        logger.warning(`Rate limit reached on ${getProviderDisplayName(provider)}, switching to ${getProviderDisplayName(fallback)}...`);

        const output = fallback === "claude"
          ? await invokeClaudeInternal(options)
          : await invokeGeminiInternal(options);

        return { output, provider: fallback };
      }

      // Return rate limited error
      const err = error as Error;
      err.message = `Rate limited on ${getProviderDisplayName(provider)}`;
      (err as Error & { rateLimited: boolean }).rateLimited = true;
      throw err;
    }

    throw error;
  }
}

/**
 * Invoke AI provider in interactive mode (stdio inherited)
 * Used for implementation sessions
 */
export async function invokeAIInteractive(
  prompt: string,
  config: GentConfig,
  providerOverride?: AIProvider
): Promise<{ result: ResultPromise; provider: AIProvider }> {
  const provider = providerOverride ?? config.ai.provider;

  if (provider === "claude") {
    const args = ["--permission-mode", config.claude.permission_mode, prompt];
    return {
      result: execa("claude", args, { stdio: "inherit" }),
      provider,
    };
  } else {
    // Gemini CLI uses -i/--prompt-interactive for interactive mode with initial prompt
    // Without -i, the positional prompt runs in one-shot mode and exits
    return {
      result: execa("gemini", ["-i", prompt], { stdio: "inherit" }),
      provider,
    };
  }
}

/**
 * Get display name for provider
 */
export function getProviderDisplayName(provider: AIProvider): string {
  return provider === "claude" ? "Claude" : "Gemini";
}

/**
 * Get email for provider co-author credit
 */
export function getProviderEmail(provider: AIProvider): string {
  return provider === "claude"
    ? "noreply@anthropic.com"
    : "noreply@google.com";
}

/**
 * Get colored provider name for display
 */
export function getProviderDisplay(provider: AIProvider): string {
  const name = getProviderDisplayName(provider);
  return provider === "claude"
    ? colors.command(name)
    : colors.label(name);
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: unknown, provider: AIProvider): boolean {
  if (!error || typeof error !== "object") return false;

  // Claude CLI uses exit code 2 for rate limiting
  if (provider === "claude" && "exitCode" in error && error.exitCode === 2) {
    return true;
  }

  // Gemini CLI may use different exit codes or error messages
  // Check for common rate limit patterns in error messages
  if ("message" in error && typeof error.message === "string") {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("quota exceeded") || msg.includes("too many requests")) {
      return true;
    }
  }

  return false;
}

/**
 * Internal Claude invocation
 */
async function invokeClaudeInternal(options: AIProviderOptions): Promise<string> {
  const args = ["--print"];

  if (options.permissionMode) {
    args.push("--permission-mode", options.permissionMode);
  }

  args.push(options.prompt);

  if (options.printOutput) {
    // Stream output to console without capturing
    const subprocess = execa("claude", args, {
      stdio: "inherit",
    });
    await subprocess;
    return "";
  } else if (options.streamOutput) {
    // Use native spawn for better streaming control
    return new Promise((resolve, reject) => {
      const child = spawn("claude", args, {
        stdio: ["inherit", "pipe", "pipe"],
      });

      let output = "";

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        process.stderr.write(chunk);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          const error = new Error(`Claude exited with code ${code}`);
          (error as Error & { exitCode: number }).exitCode = code ?? 1;
          reject(error);
        }
      });

      child.on("error", reject);
    });
  } else {
    const { stdout } = await execa("claude", args);
    return stdout;
  }
}

/**
 * Internal Gemini invocation
 */
async function invokeGeminiInternal(options: AIProviderOptions): Promise<string> {
  // Gemini CLI uses different argument structure
  const args: string[] = [];

  // Add prompt
  args.push(options.prompt);

  if (options.printOutput) {
    const subprocess = execa("gemini", args, {
      stdio: "inherit",
    });
    await subprocess;
    return "";
  } else if (options.streamOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn("gemini", args, {
        stdio: ["inherit", "pipe", "pipe"],
      });

      let output = "";

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        process.stderr.write(chunk);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          const error = new Error(`Gemini exited with code ${code}`);
          (error as Error & { exitCode: number }).exitCode = code ?? 1;
          reject(error);
        }
      });

      child.on("error", reject);
    });
  } else {
    const { stdout } = await execa("gemini", args);
    return stdout;
  }
}
