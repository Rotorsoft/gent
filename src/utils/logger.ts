import chalk from "chalk";

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

  box: (title: string, content: string) => {
    const lines = content.split("\n");
    const maxLen = Math.max(title.length, ...lines.map((l) => l.length)) + 4;
    const border = "─".repeat(maxLen);

    console.log(chalk.dim(`┌${border}┐`));
    console.log(chalk.dim("│"), chalk.bold(title.padEnd(maxLen - 2)), chalk.dim("│"));
    console.log(chalk.dim(`├${border}┤`));
    for (const line of lines) {
      console.log(chalk.dim("│"), line.padEnd(maxLen - 2), chalk.dim("│"));
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
};
