export type AIProvider = "claude" | "gemini" | "codex";

export interface GentConfig {
  version: number;
  github: GitHubConfig;
  branch: BranchConfig;
  progress: ProgressConfig;
  claude: ClaudeConfig;
  gemini: GeminiConfig;
  codex: CodexConfig;
  ai: AIConfig;
  validation: string[];
}

export interface AIConfig {
  provider: AIProvider;
  fallback_provider?: AIProvider;
  auto_fallback: boolean;
}

export interface GitHubConfig {
  labels: {
    workflow: WorkflowLabels;
    types: string[];
    priorities: string[];
    risks: string[];
    areas: string[];
  };
}

export interface WorkflowLabels {
  ready: string;
  in_progress: string;
  completed: string;
  blocked: string;
}

export interface BranchConfig {
  pattern: string;
  author_source: "git" | "env" | "prompt";
  author_env_var: string;
}

export interface ProgressConfig {
  file: string;
  archive_threshold: number;
  archive_dir: string;
}

export interface ClaudeConfig {
  permission_mode: string;
  agent_file: string;
}

export interface GeminiConfig {
  sandbox_mode: string;
  agent_file: string;
}

export interface CodexConfig {
  agent_file: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  state: "open" | "closed";
  assignee?: string;
  url: string;
}

export interface GitHubLabel {
  name: string;
  color: string;
  description?: string;
}

export interface GitHubReviewComment {
  id?: number;
  author: string;
  body: string;
  path?: string;
  line?: number | null;
  createdAt?: string;
}

export interface GitHubReview {
  author: string;
  body: string;
  state: string;
  submittedAt?: string;
}

export interface GitHubReviewThread {
  isResolved?: boolean | null;
  path?: string;
  line?: number | null;
  comments: GitHubReviewComment[];
}

export interface GitHubPRComment {
  id?: string;
  author: string;
  body: string;
  createdAt?: string;
}

export interface GitHubReviewData {
  reviews: GitHubReview[];
  reviewThreads: GitHubReviewThread[];
  comments: GitHubPRComment[];
}

export interface ProgressEntry {
  date: string;
  type: string;
  description: string;
  issue?: number;
  decisions: string[];
  files: string[];
  tests: string[];
  concerns: string[];
  followUp: string[];
  commit?: string;
}

export interface BranchInfo {
  name: string;
  author: string;
  type: string;
  issueNumber: number;
  slug: string;
}

export const DEFAULT_LABELS: Record<string, GitHubLabel[]> = {
  workflow: [
    {
      name: "ai-ready",
      color: "0E8A16",
      description: "Issue ready for AI implementation",
    },
    {
      name: "ai-in-progress",
      color: "FFA500",
      description: "AI currently working on this",
    },
    {
      name: "ai-completed",
      color: "1D76DB",
      description: "AI done, needs human review",
    },
    {
      name: "ai-blocked",
      color: "D93F0B",
      description: "AI couldn't complete, needs help",
    },
  ],
  priority: [
    {
      name: "priority:critical",
      color: "B60205",
      description: "Blocking production",
    },
    {
      name: "priority:high",
      color: "D93F0B",
      description: "Important features/bugs",
    },
    {
      name: "priority:medium",
      color: "FBCA04",
      description: "Nice-to-have improvements",
    },
    { name: "priority:low", color: "0E8A16", description: "Minor tweaks" },
  ],
  risk: [
    {
      name: "risk:low",
      color: "C2E0C6",
      description: "UI changes, tests, non-critical",
    },
    {
      name: "risk:medium",
      color: "FEF2C0",
      description: "API changes, new features",
    },
    {
      name: "risk:high",
      color: "F9D0C4",
      description: "Migrations, auth, security",
    },
  ],
  type: [
    { name: "type:feature", color: "1D76DB", description: "New feature" },
    { name: "type:fix", color: "D73A4A", description: "Bug fix" },
    {
      name: "type:refactor",
      color: "5319E7",
      description: "Code improvement",
    },
    { name: "type:chore", color: "FEF2C0", description: "Maintenance" },
    { name: "type:docs", color: "0075CA", description: "Documentation" },
    { name: "type:test", color: "D4C5F9", description: "Testing" },
  ],
  area: [
    { name: "area:ui", color: "C5DEF5", description: "User interface" },
    { name: "area:api", color: "D4C5F9", description: "API/Backend" },
    { name: "area:database", color: "FEF2C0", description: "Database/Models" },
    {
      name: "area:workers",
      color: "F9D0C4",
      description: "Background workers",
    },
    { name: "area:shared", color: "C2E0C6", description: "Shared libraries" },
    { name: "area:testing", color: "E99695", description: "Test infrastructure" },
    { name: "area:infra", color: "BFD4F2", description: "Infrastructure/DevOps" },
  ],
};
