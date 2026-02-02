import ora, { Ora } from "ora";

export function aiSpinnerText(provider: string, action: string): string {
  return `Waiting for ${provider} to ${action}...`;
}

export function createSpinner(text: string): Ora {
  return ora({
    text,
    spinner: "dots",
  });
}

export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>
): Promise<T> {
  const spinner = createSpinner(text);
  spinner.start();

  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
