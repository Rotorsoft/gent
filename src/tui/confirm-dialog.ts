import chalk from "chalk";
import { readKey } from "./key-reader.js";
import { buildModalFrame, renderOverlay, modalWidth, showCursor } from "./modal.js";

// ── Content builder (pure, testable) ─────────────────────────────

export function buildConfirmContent(
  message: string,
  selectedYes: boolean
): string[] {
  const yes = selectedYes
    ? chalk.cyan.bold("> Yes")
    : chalk.dim("  Yes");
  const no = !selectedYes
    ? chalk.cyan.bold("> No")
    : chalk.dim("  No");
  return [message, "", yes, no];
}

// ── Dialog ───────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string;
  message: string;
  dashboardLines: string[];
}

/**
 * Show a confirm dialog overlaying the dashboard.
 * Returns true for yes, false for no/cancel.
 */
export async function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  const w = modalWidth();
  let selectedYes = true;

  const render = () => {
    const content = buildConfirmContent(opts.message, selectedYes);
    const footer = "↑↓ Select  Enter Confirm  Esc Cancel";
    const lines = buildModalFrame(opts.title, content, footer, w);
    renderOverlay(opts.dashboardLines, lines, w);
  };

  render();

  while (true) {
    const key = await readKey();

    switch (key.name) {
      case "up":
      case "down":
      case "tab":
        selectedYes = !selectedYes;
        render();
        break;

      case "enter":
        process.stdout.write(showCursor());
        return selectedYes;

      case "escape":
        process.stdout.write(showCursor());
        return false;

      case "y":
        process.stdout.write(showCursor());
        return true;

      case "n":
        process.stdout.write(showCursor());
        return false;
    }
  }
}
