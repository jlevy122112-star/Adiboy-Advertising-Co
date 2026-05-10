import fs from "node:fs";

const API_BASE = "https://api.github.com";
const BACKLOG_PATH = "docs/reconstruction-backlog.md";

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function request(path, options = {}) {
  const token = requireEnv("GITHUB_TOKEN");
  const hasBody = options.body !== undefined;
  const hasExplicitContentType =
    Boolean(options.headers?.["Content-Type"]) ||
    Boolean(options.headers?.["content-type"]);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(hasBody && !hasExplicitContentType
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API ${response.status} ${path}: ${errorText}`);
  }

  return response.json();
}

async function requestGraphQL(query, variables = {}) {
  const token = requireEnv("GITHUB_TOKEN");
  const response = await fetch(`${API_BASE}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub GraphQL ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    const message = payload.errors.map((error) => error.message).join("; ");
    throw new Error(`GitHub GraphQL error: ${message}`);
  }

  return payload.data;
}

function parseBacklogItems(markdown) {
  const headerRegex = /^####\s+(B\d+)\s+-\s+(.+)$/gm;
  const matches = [...markdown.matchAll(headerRegex)];
  const items = [];

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const id = current[1];
    const title = current[2].trim();
    const blockStart = current.index;
    const blockEnd = next ? next.index : markdown.length;
    const block = markdown.slice(blockStart, blockEnd).trim();
    const dependsOnMatch = block.match(/- \*\*Depends on:\*\*\s+(.+)/);
    const outcomeMatch = block.match(/- \*\*Outcome target:\*\*\s+(.+)/);

    items.push({
      id,
      title,
      block,
      dependsOn: dependsOnMatch ? dependsOnMatch[1].trim() : "none",
      outcomeTarget: outcomeMatch ? outcomeMatch[1].trim() : "not specified",
    });
  }

  return items;
}

function buildIssueTitle(item) {
  return `[Backlog ${item.id}] ${item.title}`;
}

function buildIssueBody(item) {
  return [
    `Auto-synced from \`${BACKLOG_PATH}\`.`,
    "",
    `- Backlog ID: \`${item.id}\``,
    `- Outcome target: ${item.outcomeTarget}`,
    `- Depends on: ${item.dependsOn}`,
    "",
    "## Execution Checklist",
    "",
    "- [ ] CP1 completed",
    "- [ ] CP2 completed",
    "- [ ] CP3 completed",
    "- [ ] CP4 completed",
    "- [ ] CP5 completed",
    "- [ ] CP6 completed",
    "",
    "## Source Backlog Excerpt",
    "",
    "```md",
    item.block,
    "```",
    "",
    "_This issue is managed by `scripts/sync-backlog-to-issues.mjs`._",
    "",
  ].join("\n");
}

async function getAllIssues(owner, repo) {
  const perPage = 100;
  const allIssues = [];

  for (let page = 1; ; page += 1) {
    const query = new globalThis.URLSearchParams({
      state: "all",
      per_page: String(perPage),
      page: String(page),
    });
    const pageItems = await request(`/repos/${owner}/${repo}/issues?${query}`);

    if (!Array.isArray(pageItems)) {
      throw new Error("Unexpected GitHub issues response format.");
    }

    // The Issues API includes PRs; only keep actual issues.
    allIssues.push(
      ...pageItems.filter(
        (item) => !("pull_request" in item && item.pull_request),
      ),
    );

    if (pageItems.length < perPage) {
      break;
    }

    if (page >= 1000) {
      throw new Error(
        "Issue pagination exceeded safe limit (1000 pages). Please investigate.",
      );
    }
  }

  return allIssues;
}

async function ensureLabel(owner, repo, labelName, dryRun) {
  if (dryRun) {
    return;
  }

  try {
    await request(`/repos/${owner}/${repo}/labels`, {
      method: "POST",
      body: JSON.stringify({
        name: labelName,
        color: "0E8A16",
        description: "Backlog automation label",
      }),
    });
  } catch (error) {
    if (String(error.message).includes("422")) {
      return;
    }
    throw error;
  }
}

async function upsertIssue(owner, repo, existingIssue, item, dryRun) {
  const title = buildIssueTitle(item);
  const body = buildIssueBody(item);
  const labels = ["reconstruction-backlog", `backlog-${item.id.toLowerCase()}`];

  if (dryRun) {
    return {
      action: existingIssue ? "would_update" : "would_create",
      issueNumber: existingIssue?.number ?? null,
      issueNodeId: existingIssue?.node_id ?? null,
      title,
      labels,
    };
  }

  for (const label of labels) {
    await ensureLabel(owner, repo, label, dryRun);
  }

  if (!existingIssue) {
    const created = await request(`/repos/${owner}/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title,
        body,
        labels,
      }),
    });
    return {
      action: "created",
      issueNumber: created.number,
      issueNodeId: created.node_id,
      title,
      labels,
    };
  }

  const updated = await request(
    `/repos/${owner}/${repo}/issues/${existingIssue.number}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        title,
        body,
        state: "open",
        labels,
      }),
    },
  );
  return {
    action: "updated",
    issueNumber: updated.number,
    issueNodeId: updated.node_id,
    title,
    labels,
  };
}

function parseProjectBoardUrl(projectBoardUrl) {
  if (!projectBoardUrl) {
    return null;
  }

  const match = projectBoardUrl.match(
    /github\.com\/orgs\/([^/]+)\/projects\/(\d+)/,
  );
  if (!match) {
    return null;
  }

  return {
    organization: match[1],
    projectNumber: Number(match[2]),
  };
}

async function resolveProjectId(projectInfo) {
  if (!projectInfo) {
    return null;
  }

  const query = `
    query ResolveProject($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) {
          id
        }
      }
    }
  `;

  const data = await requestGraphQL(query, {
    org: projectInfo.organization,
    number: projectInfo.projectNumber,
  });
  return data.organization?.projectV2?.id ?? null;
}

async function addIssueToProject(projectId, issueNodeId, dryRun) {
  if (!projectId || !issueNodeId || dryRun) {
    return;
  }

  const mutation = `
    mutation AddItem($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item {
          id
        }
      }
    }
  `;

  try {
    await requestGraphQL(mutation, {
      projectId,
      contentId: issueNodeId,
    });
  } catch (error) {
    const message = String(error.message);
    if (message.includes("already exists")) {
      return;
    }
    throw error;
  }
}

function printSummary(results, dryRun) {
  console.log(
    dryRun
      ? "Backlog sync dry-run complete. Planned operations:"
      : "Backlog sync complete. Applied operations:",
  );
  for (const result of results) {
    console.log(
      `- ${result.action} ${result.title}${result.issueNumber ? ` (#${result.issueNumber})` : ""}`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const projectBoardUrl = process.env.PROJECT_BOARD_URL ?? "";
  const [owner, repo] = repository.split("/");

  if ((!owner || !repo) && !options.dryRun) {
    throw new Error(
      "Invalid GITHUB_REPOSITORY value. Expected format: owner/repo.",
    );
  }

  const backlogMarkdown = fs.readFileSync(BACKLOG_PATH, "utf8");
  const backlogItems = parseBacklogItems(backlogMarkdown);
  if (backlogItems.length === 0) {
    throw new Error(`No backlog items found in ${BACKLOG_PATH}.`);
  }

  const existingIssues = owner && repo ? await getAllIssues(owner, repo) : [];
  const issueMap = new Map(existingIssues.map((issue) => [issue.title, issue]));
  const projectInfo = parseProjectBoardUrl(projectBoardUrl);
  const projectId =
    projectInfo && !options.dryRun ? await resolveProjectId(projectInfo) : null;

  const results = [];
  for (const item of backlogItems) {
    const title = buildIssueTitle(item);
    const existingIssue = issueMap.get(title);
    const result = await upsertIssue(
      owner,
      repo,
      existingIssue,
      item,
      options.dryRun,
    );
    results.push(result);
    await addIssueToProject(projectId, result.issueNodeId, options.dryRun);
  }

  printSummary(results, options.dryRun);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
