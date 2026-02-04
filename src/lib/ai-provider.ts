import { spawn } from "child_process";
import { execa, type ResultPromise } from "execa";
import type { GentConfig, AIProvider } from "../types/index.js";
import { logger, colors } from "../utils/logger.js";

import { checkAIProvider } from "../utils/validators.js";

/** Default timeout for AI provider calls (30 seconds) */
export const AI_DEFAULT_TIMEOUT_MS = 30_000;

export interface AIProviderOptions {
  prompt: string;
  permissionMode?: string;
  printOutput?: boolean;
  streamOutput?: boolean;
  onFirstData?: () => void;
  /** Timeout in milliseconds for non-streaming calls. Defaults to AI_DEFAULT_TIMEOUT_MS */
  timeout?: number;
}

export interface AIProviderResult {
  output: string;
  provider: AIProvider;
  rateLimited?: boolean;
}

/**
 * Get list of available AI providers except the current one
 */
export async function getOtherAvailableProviders(
  currentProvider: AIProvider
): Promise<AIProvider[]> {
  const allProviders: AIProvider[] = ["claude", "gemini", "codex"];
  const others = allProviders.filter((p) => p !== currentProvider);
  const available: AIProvider[] = [];

  for (const p of others) {
    if (await checkAIProvider(p)) {
      available.push(p);
    }
  }

  return available;
}

async function invokeInternal(
  provider: AIProvider,
  options: AIProviderOptions
): Promise<string> {
  switch (provider) {
    case "claude":
      return invokeClaudeInternal(options);
    case "gemini":
      return invokeGeminiInternal(options);
    case "codex":
      return invokeCodexInternal(options);
  }
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
    const output = await invokeInternal(provider, options);

    return { output, provider };
  } catch (error) {
    // Check for rate limiting
    if (isRateLimitError(error, provider)) {
      // Try fallback if configured
      if (
        config.ai.auto_fallback &&
        config.ai.fallback_provider &&
        !providerOverride
      ) {
        const fallback = config.ai.fallback_provider;
        logger.warning(
          `Rate limit reached on ${getProviderDisplayName(provider)}, switching to ${getProviderDisplayName(fallback)}...`
        );

        const output = await invokeInternal(fallback, options);

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

  switch (provider) {
    case "claude": {
      const args = ["--permission-mode", config.claude.permission_mode, prompt];
      return {
        result: execa("claude", args, { stdio: "inherit" }),
        provider,
      };
    }
    case "gemini": {
      // Gemini CLI uses -i/--prompt-interactive for interactive mode with initial prompt
      // Without -i, the positional prompt runs in one-shot mode and exits
      return {
        result: execa("gemini", ["-i", prompt], { stdio: "inherit" }),
        provider,
      };
    }
    case "codex": {
      // Codex CLI uses the TUI for interactive sessions; prompt is optional
      const args = prompt ? [prompt] : [];
      return {
        result: execa("codex", args, { stdio: "inherit" }),
        provider,
      };
    }
  }
}

/**
 * Get display name for provider
 */
export function getProviderDisplayName(provider: AIProvider): string {
  switch (provider) {
    case "claude":
      return "Claude";
    case "gemini":
      return "Gemini";
    case "codex":
      return "Codex";
  }
}

/**
 * Get email for provider co-author credit
 */
export function getProviderEmail(provider: AIProvider): string {
  switch (provider) {
    case "claude":
      return "noreply@anthropic.com";
    case "gemini":
      return "noreply@google.com";
    case "codex":
      return "noreply@openai.com";
  }
}

/**
 * Get colored provider name for display
 */
export function getProviderDisplay(provider: AIProvider): string {
  const name = getProviderDisplayName(provider);
  switch (provider) {
    case "claude":
      return colors.command(name);
    case "gemini":
      return colors.label(name);
    case "codex":
      return colors.file(name);
  }
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: unknown, provider: AIProvider): boolean {
  if (!error || typeof error !== "object") return false;

  // Claude and Codex CLIs may use exit code 2 for rate limiting
  if (
    (provider === "claude" || provider === "codex") &&
    "exitCode" in error &&
    error.exitCode === 2
  ) {
    return true;
  }

  // Gemini CLI may use different exit codes or error messages
  // Check for common rate limit patterns in error messages
  if ("message" in error && typeof error.message === "string") {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("rate limit") ||
      msg.includes("quota exceeded") ||
      msg.includes("too many requests")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // execa sets timedOut property on timeout
  if ("timedOut" in error && error.timedOut === true) {
    return true;
  }

  // Also check for ETIMEDOUT error code
  if ("code" in error && error.code === "ETIMEDOUT") {
    return true;
  }

  return false;
}

/**
 * Internal Claude invocation
 */
async function invokeClaudeInternal(
  options: AIProviderOptions
): Promise<string> {
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
      let firstData = true;

      child.stdout.on("data", (chunk: Buffer) => {
        if (firstData) {
          firstData = false;
          options.onFirstData?.();
        }
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
    const timeout = options.timeout ?? AI_DEFAULT_TIMEOUT_MS;
    const { stdout } = await execa("claude", args, { timeout });
    return stdout;
  }
}

/**
 * Internal Gemini invocation
 */
async function invokeGeminiInternal(
  options: AIProviderOptions
): Promise<string> {
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
      let firstData = true;

      child.stdout.on("data", (chunk: Buffer) => {
        if (firstData) {
          firstData = false;
          options.onFirstData?.();
        }
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
    const timeout = options.timeout ?? AI_DEFAULT_TIMEOUT_MS;
    const { stdout } = await execa("gemini", args, { timeout });
    return stdout;
  }
}

/**
 * Internal Codex invocation
 */
async function invokeCodexInternal(
  options: AIProviderOptions
): Promise<string> {
  // Use non-interactive mode to avoid TTY requirements
  const args = ["exec", options.prompt];

  if (options.printOutput) {
    const subprocess = execa("codex", args, {
      stdio: "inherit",
    });
    await subprocess;
    return "";
  } else if (options.streamOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn("codex", args, {
        stdio: ["inherit", "pipe", "pipe"],
      });

      let output = "";
      let firstData = true;

      child.stdout.on("data", (chunk: Buffer) => {
        if (firstData) {
          firstData = false;
          options.onFirstData?.();
        }
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
          const error = new Error(`Codex exited with code ${code}`);
          (error as Error & { exitCode: number }).exitCode = code ?? 1;
          reject(error);
        }
      });

      child.on("error", reject);
    });
  } else {
    const timeout = options.timeout ?? AI_DEFAULT_TIMEOUT_MS;
    const { stdout } = await execa("codex", args, { timeout });
    return stdout;
  }
}
