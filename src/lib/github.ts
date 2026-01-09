import { execa } from "execa";
import type { GitHubIssue, GitHubLabel } from "../types/index.js";

export async function getIssue(issueNumber: number): Promise<GitHubIssue> {
  const { stdout } = await execa("gh", [
    "issue",
    "view",
    String(issueNumber),
    "--json",
    "number,title,body,labels,state,assignees,url",
  ]);

  const data = JSON.parse(stdout);
  return {
    number: data.number,
    title: data.title,
    body: data.body || "",
    labels: data.labels.map((l: { name: string }) => l.name),
    state: data.state.toLowerCase(),
    assignee: data.assignees?.[0]?.login,
    url: data.url,
  };
}

export async function listIssues(options: {
  labels?: string[];
  state?: "open" | "closed" | "all";
  limit?: number;
}): Promise<GitHubIssue[]> {
  const args = ["issue", "list", "--json", "number,title,body,labels,state,url"];

  if (options.labels?.length) {
    args.push("--label", options.labels.join(","));
  }

  if (options.state) {
    args.push("--state", options.state);
  }

  args.push("--limit", String(options.limit || 50));

  const { stdout } = await execa("gh", args);
  const data = JSON.parse(stdout);

  return data.map(
    (d: {
      number: number;
      title: string;
      body: string;
      labels: { name: string }[];
      state: string;
      url: string;
    }) => ({
      number: d.number,
      title: d.title,
      body: d.body || "",
      labels: d.labels.map((l) => l.name),
      state: d.state.toLowerCase() as "open" | "closed",
      url: d.url,
    })
  );
}

export async function createIssue(options: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<number> {
  const args = ["issue", "create", "--title", options.title, "--body", options.body];

  if (options.labels?.length) {
    args.push("--label", options.labels.join(","));
  }

  const { stdout } = await execa("gh", args);

  // Extract issue number from URL
  const match = stdout.match(/\/issues\/(\d+)/);
  if (!match) {
    throw new Error("Failed to extract issue number from gh output");
  }

  return parseInt(match[1], 10);
}

export async function updateIssueLabels(
  issueNumber: number,
  options: {
    add?: string[];
    remove?: string[];
  }
): Promise<void> {
  const promises: Promise<unknown>[] = [];

  if (options.add?.length) {
    promises.push(
      execa("gh", [
        "issue",
        "edit",
        String(issueNumber),
        "--add-label",
        options.add.join(","),
      ])
    );
  }

  if (options.remove?.length) {
    promises.push(
      execa("gh", [
        "issue",
        "edit",
        String(issueNumber),
        "--remove-label",
        options.remove.join(","),
      ])
    );
  }

  await Promise.all(promises);
}

export async function addIssueComment(
  issueNumber: number,
  body: string
): Promise<void> {
  await execa("gh", ["issue", "comment", String(issueNumber), "--body", body]);
}

export async function assignIssue(
  issueNumber: number,
  assignee: string
): Promise<void> {
  await execa("gh", [
    "issue",
    "edit",
    String(issueNumber),
    "--add-assignee",
    assignee,
  ]);
}

export async function createLabel(label: GitHubLabel): Promise<void> {
  try {
    await execa("gh", [
      "label",
      "create",
      label.name,
      "--color",
      label.color,
      "--description",
      label.description || "",
      "--force",
    ]);
  } catch {
    // Label might already exist, ignore error
  }
}

export async function createPullRequest(options: {
  title: string;
  body: string;
  base?: string;
  draft?: boolean;
}): Promise<string> {
  const args = [
    "pr",
    "create",
    "--title",
    options.title,
    "--body",
    options.body,
    "--assignee",
    "@me",
  ];

  if (options.base) {
    args.push("--base", options.base);
  }

  if (options.draft) {
    args.push("--draft");
  }

  const { stdout } = await execa("gh", args);
  return stdout.trim();
}

export async function getPrForBranch(): Promise<{
  number: number;
  url: string;
} | null> {
  try {
    const { stdout } = await execa("gh", [
      "pr",
      "view",
      "--json",
      "number,url",
    ]);
    const data = JSON.parse(stdout);
    return { number: data.number, url: data.url };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<string> {
  const { stdout } = await execa("gh", ["api", "user", "--jq", ".login"]);
  return stdout.trim();
}
