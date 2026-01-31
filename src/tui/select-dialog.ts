import chalk from "chalk";
import { truncateAnsi } from "./display.js";
import { readKey } from "./key-reader.js";
import { buildModalFrame, renderOverlay, modalWidth, showCursor } from "./modal.js";

// ── Types ────────────────────────────────────────────────────────

export interface SelectItem {
  name: string;
  value: string;
}

export interface SelectSeparator {
  separator: string;
}

export type SelectEntry = SelectItem | SelectSeparator;

function isSeparator(entry: SelectEntry): entry is SelectSeparator {
  return "separator" in entry;
}

// ── Content builder (pure, testable) ─────────────────────────────

export function buildSelectContent(
  items: SelectEntry[],
  selectedIndex: number,
  maxWidth: number,
  currentIndex?: number
): string[] {
  const lines: string[] = [];
  let selectableIdx = 0;

  for (const item of items) {
    if (isSeparator(item)) {
      lines.push(chalk.dim(item.separator));
    } else {
      const isSelected = selectableIdx === selectedIndex;
      const isCurrent = currentIndex != null && selectableIdx === currentIndex;
      const prefix = isSelected ? chalk.cyan.bold("> ") : "  ";
      const bullet = chalk.dim("· ");
      const label = truncateAnsi(item.name, maxWidth - 4);
      const styledLabel = isSelected
        ? chalk.bold(label)
        : isCurrent
          ? chalk.cyan(label)
          : label;
      lines.push(prefix + bullet + styledLabel);
      selectableIdx++;
    }
  }

  return lines;
}

// ── Dialog ───────────────────────────────────────────────────────

export interface SelectOptions {
  title: string;
  items: SelectEntry[];
  dashboardLines: string[];
  initialIndex?: number;
  currentIndex?: number;
}

/**
 * Get the selectable items count (excluding separators).
 */
function selectableCount(items: SelectEntry[]): number {
  return items.filter((i) => !isSeparator(i)).length;
}

/**
 * Show a select dialog overlaying the dashboard.
 * Returns the selected value or null if cancelled.
 */
export async function showSelect(opts: SelectOptions): Promise<string | null> {
  const w = modalWidth();
  const maxItems = selectableCount(opts.items);
  if (maxItems === 0) return null;

  let selectedIndex = opts.initialIndex ?? 0;

  const render = () => {
    const content = buildSelectContent(opts.items, selectedIndex, w - 6, opts.currentIndex);
    const footer = "↑↓ Navigate  Enter Select  Esc Cancel";
    const lines = buildModalFrame(opts.title, content, footer, w);
    renderOverlay(opts.dashboardLines, lines, w);
  };

  render();

  while (true) {
    const key = await readKey();

    switch (key.name) {
      case "up":
        selectedIndex = (selectedIndex - 1 + maxItems) % maxItems;
        render();
        break;

      case "down":
        selectedIndex = (selectedIndex + 1) % maxItems;
        render();
        break;

      case "enter": {
        process.stdout.write(showCursor());
        // Find the nth selectable item
        let idx = 0;
        for (const item of opts.items) {
          if (!isSeparator(item)) {
            if (idx === selectedIndex) return item.value;
            idx++;
          }
        }
        return null;
      }

      case "escape":
        process.stdout.write(showCursor());
        return null;
    }
  }
}
