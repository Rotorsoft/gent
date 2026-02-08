import chalk from "chalk";
import { readKey } from "./key-reader.js";
import { buildModalFrame, renderOverlay, modalWidth, showCursor } from "./modal.js";

// ── Content builder (pure, testable) ─────────────────────────────

export function buildInputContent(
  label: string,
  value: string,
  cursorVisible: boolean
): string[] {
  const cursorChar = cursorVisible ? chalk.inverse(" ") : "";
  return [label, "", chalk.cyan("> ") + value + cursorChar];
}

// ── Dialog ───────────────────────────────────────────────────────

export interface InputOptions {
  title: string;
  label: string;
  dashboardLines: string[];
}

/**
 * Show a text input dialog overlaying the dashboard.
 * Returns the entered text or null if cancelled.
 */
export async function showInput(opts: InputOptions): Promise<string | null> {
  const w = modalWidth();
  let value = "";
  let cursorBlink = true;

  const render = () => {
    const maxLen = w - 10;
    const displayValue = value.length > maxLen
      ? value.slice(value.length - maxLen)
      : value;
    const content = buildInputContent(opts.label, displayValue, cursorBlink);
    const footer = "Enter Submit  Esc Cancel";
    const lines = buildModalFrame(opts.title, content, footer, w);
    renderOverlay(opts.dashboardLines, lines, w);
  };

  render();

  while (true) {
    const key = await readKey();

    switch (key.name) {
      case "enter":
        process.stdout.write(showCursor());
        return value.trim() || null;

      case "escape":
        process.stdout.write(showCursor());
        return null;

      case "backspace":
        if (value.length > 0) {
          value = value.slice(0, -1);
        }
        render();
        break;

      case "paste": {
        const flat = key.raw.replace(/\n/g, "");
        if (flat.length > 0) {
          value += flat;
          cursorBlink = true;
          render();
        }
        break;
      }

      default:
        // Single printable character
        if (key.raw.length === 1 && key.raw.charCodeAt(0) >= 32) {
          value += key.raw;
          cursorBlink = true;
          render();
        }
        break;
    }
  }
}
