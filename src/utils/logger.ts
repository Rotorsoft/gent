import chalk from "chalk";

// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");
const visibleLength = (str: string) => stripAnsi(str).length;

export interface TableEntry {
  key: string;
  value: string;
}

export const logger = {
  info: (message: string) => console.log(chalk.blue("ℹ"), message),
  success: (message: string) => console.log(chalk.green("✓"), message),
  warning: (message: string) => console.log(chalk.yellow("⚠"), message),
  error: (message: string) => console.log(chalk.red("✗"), message),
  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray("⋯"), message);
    }
  },
  dim: (message: string) => console.log(chalk.dim(message)),
  bold: (message: string) => console.log(chalk.bold(message)),
  highlight: (message: string) => console.log(chalk.cyan(message)),

  /**
   * Display a bordered table with key-value pairs.
   * Used for operation summaries before AI invocation.
   */
  table: (title: string, entries: TableEntry[]) => {
    // Filter out entries with empty values
    const validEntries = entries.filter((e) => e.value);
    if (validEntries.length === 0) return;

    // Calculate column widths
    const keyWidth = Math.max(...validEntries.map((e) => e.key.length));
    const valueWidth = Math.max(
      ...validEntries.map((e) => visibleLength(e.value))
    );
    const innerWidth = Math.max(title.length, keyWidth + valueWidth + 3); // 3 = " : "
    const totalWidth = innerWidth + 4; // 4 = "│ " + " │"

    // Pad string to target length accounting for ANSI codes
    const padVisible = (str: string, len: number) => {
      const visible = visibleLength(str);
      return str + " ".repeat(Math.max(0, len - visible));
    };

    // Render
    console.log(chalk.dim("┌" + "─".repeat(totalWidth - 2) + "┐"));
    console.log(
      `${chalk.dim("│")} ${chalk.bold.cyan(title.padEnd(innerWidth))} ${chalk.dim("│")}`
    );
    console.log(chalk.dim("├" + "─".repeat(totalWidth - 2) + "┤"));
    for (const { key, value } of validEntries) {
      const row = chalk.dim(key.padEnd(keyWidth)) + "  " + value;
      console.log(
        `${chalk.dim("│")} ${padVisible(row, innerWidth)} ${chalk.dim("│")}`
      );
    }
    console.log(chalk.dim("└" + "─".repeat(totalWidth - 2) + "┘"));
  },

  box: (title: string, content: string) => {
    const lines = content.split("\n");
    // Calculate visible length (strips ANSI codes) for proper alignment
    const maxLen =
      Math.max(title.length, ...lines.map((l) => visibleLength(l))) + 4;
    const border = "─".repeat(maxLen);

    // Pad string to target length accounting for ANSI codes
    const padVisible = (str: string, len: number) => {
      const visible = visibleLength(str);
      return str + " ".repeat(Math.max(0, len - visible));
    };

    console.log(chalk.dim(`┌${border}┐`));
    console.log(
      `${chalk.dim("│")} ${chalk.bold(title.padEnd(maxLen - 2))} ${chalk.dim("│")}`
    );
    console.log(chalk.dim(`├${border}┤`));
    for (const line of lines) {
      console.log(
        `${chalk.dim("│")} ${padVisible(line, maxLen - 2)} ${chalk.dim("│")}`
      );
    }
    console.log(chalk.dim(`└${border}┘`));
  },

  list: (items: string[], bullet = "•") => {
    for (const item of items) {
      console.log(chalk.dim(bullet), item);
    }
  },

  newline: () => console.log(),
};

export const colors = {
  issue: chalk.cyan,
  branch: chalk.magenta,
  label: chalk.yellow,
  file: chalk.green,
  command: chalk.blue,
  url: chalk.underline.blue,
  provider: chalk.cyan.bold,
};
