import { execa } from "execa";
import type { GitHubIssue, GitHubLabel, GitHubReviewData } from "../types/index.js";

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

export async function getPrReviewData(prNumber?: number): Promise<GitHubReviewData> {
  // Fetch reviews and comments using gh pr view (both are supported JSON fields)
  const prArgs = ["pr", "view"];
  if (prNumber) {
    prArgs.push(String(prNumber));
  }
  prArgs.push("--json", "reviews,comments");

  const { stdout: prStdout } = await execa("gh", prArgs);
  const prData = JSON.parse(prStdout);

  // Fetch review threads using GraphQL API (not available via gh pr view --json)
  // First get repo owner and name since GraphQL doesn't support {owner}/{repo} placeholders
  let reviewThreads: Array<{
    isResolved?: boolean | null;
    isOutdated?: boolean;
    path?: string;
    line?: number | null;
    comments: Array<{
      author: string;
      body: string;
      path?: string;
      line?: number | null;
      createdAt?: string;
    }>;
  }> = [];

  try {
    const { stdout: repoStdout } = await execa("gh", ["repo", "view", "--json", "owner,name"]);
    const repoData = JSON.parse(repoStdout);
    const owner = repoData.owner?.login ?? repoData.owner;
    const repo = repoData.name;

    const graphqlQuery = `query { repository(owner: "${owner}", name: "${repo}") { pullRequest(number: ${prNumber}) { reviewThreads(first: 100) { nodes { isResolved isOutdated path line comments(first: 100) { nodes { databaseId author { login } body path line createdAt } } } } } } }`;

    const { stdout: graphqlStdout } = await execa("gh", ["api", "graphql", "-f", `query=${graphqlQuery}`]);
    const graphqlData = JSON.parse(graphqlStdout);
    const prNode = graphqlData.data?.repository?.pullRequest;
    const threadNodes = prNode?.reviewThreads?.nodes ?? [];

    reviewThreads = threadNodes.map((thread: {
      isResolved?: boolean | null;
      isOutdated?: boolean;
      path?: string;
      line?: number | null;
      comments?: { nodes?: Array<{
        databaseId?: number;
        author?: { login?: string };
        body?: string;
        path?: string;
        line?: number | null;
        createdAt?: string;
      }> };
    }) => ({
      isResolved: thread.isResolved ?? null,
      isOutdated: thread.isOutdated ?? false,
      path: thread.path,
      line: thread.line ?? null,
      comments: (thread.comments?.nodes ?? []).map((comment) => ({
        id: comment.databaseId,
        author: comment.author?.login ?? "unknown",
        body: comment.body ?? "",
        path: comment.path ?? thread.path,
        line: comment.line ?? thread.line ?? null,
        createdAt: comment.createdAt,
      })),
    }));
  } catch {
    // If GraphQL fails (e.g., no permissions), continue with empty threads
    reviewThreads = [];
  }

  return {
    reviews: (prData.reviews ?? []).map((review: {
      author?: { login?: string };
      body?: string;
      state?: string;
      submittedAt?: string;
    }) => ({
      author: review.author?.login ?? "unknown",
      body: review.body ?? "",
      state: review.state ?? "UNKNOWN",
      submittedAt: review.submittedAt,
    })),
    reviewThreads,
    comments: (prData.comments ?? []).map((comment: {
      id?: string;
      author?: { login?: string };
      body?: string;
      createdAt?: string;
    }) => ({
      id: comment.id,
      author: comment.author?.login ?? "unknown",
      body: comment.body ?? "",
      createdAt: comment.createdAt,
    })),
  };
}

export async function getCurrentUser(): Promise<string> {
  const { stdout } = await execa("gh", ["api", "user", "--jq", ".login"]);
  return stdout.trim();
}

export async function replyToReviewComment(
  prNumber: number,
  commentId: number,
  body: string
): Promise<void> {
  await execa("gh", [
    "api",
    `repos/{owner}/{repo}/pulls/${prNumber}/comments/${commentId}/replies`,
    "-f",
    `body=${body}`,
  ]);
}

export async function addPrComment(prNumber: number, body: string): Promise<void> {
  await execa("gh", ["pr", "comment", String(prNumber), "--body", body]);
}
