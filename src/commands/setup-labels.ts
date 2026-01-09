import { logger, colors } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { loadConfig } from "../lib/config.js";
import { getAllLabels } from "../lib/labels.js";
import { createLabel } from "../lib/github.js";
import { checkGhAuth } from "../utils/validators.js";

export async function setupLabelsCommand(): Promise<void> {
  logger.bold("Setting up GitHub labels...");
  logger.newline();

  // Check gh auth
  const isAuthed = await checkGhAuth();
  if (!isAuthed) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    process.exit(1);
  }

  const config = loadConfig();
  const labels = getAllLabels(config);

  logger.info(`Creating ${labels.length} labels...`);
  logger.newline();

  let created = 0;
  let failed = 0;

  for (const label of labels) {
    try {
      await withSpinner(`Creating ${colors.label(label.name)}`, async () => {
        await createLabel(label);
      });
      created++;
    } catch (error) {
      logger.error(`Failed to create ${label.name}: ${error}`);
      failed++;
    }
  }

  logger.newline();
  logger.success(`Created ${created} labels`);
  if (failed > 0) {
    logger.warning(`Failed to create ${failed} labels`);
  }

  logger.newline();
  logger.info("Labels are ready. You can now create AI-ready issues.");
}
