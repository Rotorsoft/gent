import type { GentConfig, GitHubLabel } from "../types/index.js";
import { DEFAULT_LABELS } from "../types/index.js";

export function getAllLabels(config: GentConfig): GitHubLabel[] {
  const labels: GitHubLabel[] = [];

  // Workflow labels
  labels.push(...DEFAULT_LABELS.workflow);

  // Priority labels
  for (const priority of config.github.labels.priorities) {
    const defaultLabel = DEFAULT_LABELS.priority.find(
      (l) => l.name === `priority:${priority}`
    );
    if (defaultLabel) {
      labels.push(defaultLabel);
    } else {
      labels.push({
        name: `priority:${priority}`,
        color: "FBCA04",
        description: `Priority: ${priority}`,
      });
    }
  }

  // Risk labels
  for (const risk of config.github.labels.risks) {
    const defaultLabel = DEFAULT_LABELS.risk.find(
      (l) => l.name === `risk:${risk}`
    );
    if (defaultLabel) {
      labels.push(defaultLabel);
    } else {
      labels.push({
        name: `risk:${risk}`,
        color: "FEF2C0",
        description: `Risk: ${risk}`,
      });
    }
  }

  // Type labels
  for (const type of config.github.labels.types) {
    const defaultLabel = DEFAULT_LABELS.type.find(
      (l) => l.name === `type:${type}`
    );
    if (defaultLabel) {
      labels.push(defaultLabel);
    } else {
      labels.push({
        name: `type:${type}`,
        color: "1D76DB",
        description: `Type: ${type}`,
      });
    }
  }

  // Area labels
  for (const area of config.github.labels.areas) {
    const defaultLabel = DEFAULT_LABELS.area.find(
      (l) => l.name === `area:${area}`
    );
    if (defaultLabel) {
      labels.push(defaultLabel);
    } else {
      labels.push({
        name: `area:${area}`,
        color: "C5DEF5",
        description: `Area: ${area}`,
      });
    }
  }

  return labels;
}

export function getWorkflowLabels(config: GentConfig): {
  ready: string;
  inProgress: string;
  completed: string;
  blocked: string;
} {
  return {
    ready: config.github.labels.workflow.ready,
    inProgress: config.github.labels.workflow.in_progress,
    completed: config.github.labels.workflow.completed,
    blocked: config.github.labels.workflow.blocked,
  };
}

export function buildIssueLabels(meta: {
  type: string;
  priority: string;
  risk: string;
  area: string;
}): string[] {
  return [
    "ai-ready",
    `type:${meta.type}`,
    `priority:${meta.priority}`,
    `risk:${meta.risk}`,
    `area:${meta.area}`,
  ];
}

export function extractTypeFromLabels(labels: string[]): string {
  for (const label of labels) {
    if (label.startsWith("type:")) {
      return label.replace("type:", "");
    }
  }
  return "feature";
}

export function extractPriorityFromLabels(labels: string[]): string {
  for (const label of labels) {
    if (label.startsWith("priority:")) {
      return label.replace("priority:", "");
    }
  }
  return "medium";
}

export function hasWorkflowLabel(
  labels: string[],
  workflowLabel: string
): boolean {
  return labels.includes(workflowLabel);
}

export function sortByPriority(issues: { labels: string[] }[]): void {
  const priorityOrder = ["critical", "high", "medium", "low"];

  issues.sort((a, b) => {
    const aPriority = extractPriorityFromLabels(a.labels);
    const bPriority = extractPriorityFromLabels(b.labels);
    return priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
  });
}
