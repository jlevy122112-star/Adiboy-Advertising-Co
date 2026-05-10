import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const reportsDir = path.join(rootDir, "reports", "tests-checks");
const latestReportPath = path.join(reportsDir, "latest.json");
const historyReportPath = path.join(reportsDir, "history.ndjson");
const latestSummaryPath = path.join(reportsDir, "latest-summary.md");
const lastSuccessPath = path.join(reportsDir, "last-success.json");
const lastSuccessSummaryPath = path.join(reportsDir, "last-success-summary.md");
const lockPath = path.join(reportsDir, ".lock");
const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_THRESHOLD = 2;
const DEFAULT_PROFILE = "full";
const DEFAULT_CONFIG_PATH = "tests-checks.config.json";

function parseArgs(argv) {
  const options = {
    mode: "watch",
    intervalMs: undefined,
    threshold: undefined,
    profile: DEFAULT_PROFILE,
    configPath: DEFAULT_CONFIG_PATH,
    forceRun: false,
  };

  for (const arg of argv) {
    if (arg === "--once") {
      options.mode = "once";
      continue;
    }

    if (arg === "--watch") {
      options.mode = "watch";
      continue;
    }

    if (arg.startsWith("--interval-ms=")) {
      options.intervalMs = Number(arg.slice("--interval-ms=".length));
      continue;
    }

    if (arg.startsWith("--threshold=")) {
      options.threshold = Number(arg.slice("--threshold=".length));
      continue;
    }

    if (arg.startsWith("--profile=")) {
      options.profile = arg.slice("--profile=".length);
      continue;
    }

    if (arg.startsWith("--config=")) {
      options.configPath = arg.slice("--config=".length);
      continue;
    }

    if (arg === "--force-run") {
      options.forceRun = true;
    }
  }

  if (
    options.intervalMs !== undefined &&
    (!Number.isInteger(options.intervalMs) || options.intervalMs <= 0)
  ) {
    throw new Error("Invalid --interval-ms value. Use a positive integer.");
  }

  if (
    options.threshold !== undefined &&
    (!Number.isInteger(options.threshold) || options.threshold <= 0)
  ) {
    throw new Error("Invalid --threshold value. Use a positive integer.");
  }

  return options;
}

function loadConfig(configPath) {
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.join(rootDir, configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  const config = JSON.parse(raw);
  return { absolutePath, config };
}

function runShellCommand(command) {
  return spawnSync(command, {
    cwd: rootDir,
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function getPendingFiles() {
  const result = runShellCommand("git status --porcelain -z");
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to read git status.");
  }

  const tokens = result.stdout.split("\0").filter((token) => token.length > 0);
  const pendingFiles = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const entry = tokens[index];
    if (entry.length < 4) {
      continue;
    }

    const status = entry.slice(0, 2).trim();
    const rawPath = entry.slice(3);
    let file = rawPath;

    // In porcelain -z output, rename/copy entries include old path followed by new path.
    if (
      (status.startsWith("R") || status.startsWith("C")) &&
      tokens[index + 1]
    ) {
      file = tokens[index + 1];
      index += 1;
    }

    pendingFiles.push({ status, file });
  }

  return pendingFiles;
}

function ensureReportsDir() {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function appendReport(report, options = {}) {
  const { updateLatest = true } = options;
  ensureReportsDir();
  fs.appendFileSync(historyReportPath, `${JSON.stringify(report)}\n`, "utf8");
  if (updateLatest) {
    fs.writeFileSync(
      latestReportPath,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(latestSummaryPath, toSummaryMarkdown(report), "utf8");
  }
  if (updateLatest && report.stepRun?.success) {
    fs.writeFileSync(
      lastSuccessPath,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(lastSuccessSummaryPath, toSummaryMarkdown(report), "utf8");
  }
}

function createBaseReport({ pendingFiles, threshold, profile }) {
  const nowIso = new Date().toISOString();
  const ready = pendingFiles.length >= threshold;
  return {
    occurredAt: nowIso,
    threshold,
    pendingFileCount: pendingFiles.length,
    pendingFiles: pendingFiles.map((entry) => entry.file),
    profile,
    ready,
  };
}

function setCommitDecision(report, readyToCommit, reason) {
  report.readyToCommit = readyToCommit;
  report.commitDecisionReason = reason;
}

function runProfileSteps(profileConfig) {
  const steps = [];
  for (const step of profileConfig.steps ?? []) {
    const startedAt = new Date().toISOString();
    const result = runShellCommand(step.command);
    const endedAt = new Date().toISOString();
    const stepResult = {
      id: step.id,
      command: step.command,
      startedAt,
      endedAt,
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      success: result.status === 0,
    };
    steps.push(stepResult);
    if (!stepResult.success) {
      break;
    }
  }

  const failedStep = steps.find((step) => !step.success) ?? null;
  return {
    success: failedStep === null,
    failedStepId: failedStep?.id ?? null,
    steps,
  };
}

function buildSignature(pendingFiles) {
  return pendingFiles.map((entry) => `${entry.status}:${entry.file}`).join("|");
}

function logLine(message) {
  console.log(`[tests-checks] ${new Date().toISOString()} ${message}`);
}

function showFailurePopup(pendingFileCount, profile) {
  if (process.platform !== "win32") {
    return;
  }

  const title = "Reconstruction Tests Failed";
  const body = `Tests/checks failed for profile "${profile}". ${pendingFileCount} pending file(s) are waiting for review. Open reports/tests-checks/latest.json for details.`;
  const popupCommand = `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${body.replace(
    /'/g,
    "''",
  )}', '${title.replace(/'/g, "''")}', 'OK', 'Warning')`;

  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", popupCommand],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: "ignore",
      windowsHide: true,
      timeout: 15000,
    },
  );

  if (result.error) {
    logLine(`Popup warning failed: ${result.error.message}`);
  }
}

function toSummaryMarkdown(report) {
  const lines = [
    "# Tests & Checks Summary",
    "",
    `- Occurred at: ${report.occurredAt}`,
    `- Profile: ${report.profile}`,
    `- Pending files: ${report.pendingFileCount}`,
    `- Ready trigger met: ${report.ready}`,
    `- Ready to commit: ${report.readyToCommit ?? false}`,
    `- Decision reason: ${report.commitDecisionReason ?? "n/a"}`,
  ];

  if (report.skippedReason) {
    lines.push(`- Skipped reason: ${report.skippedReason}`);
  }

  if (report.stepRun) {
    lines.push("", "## Step Results", "");
    for (const step of report.stepRun.steps) {
      lines.push(
        `- [${step.success ? "PASS" : "FAIL"}] ${step.id} (${step.command})`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function acquireLock() {
  ensureReportsDir();
  if (fs.existsSync(lockPath)) {
    try {
      const lockRaw = fs.readFileSync(lockPath, "utf8");
      const lock = JSON.parse(lockRaw);
      if (isProcessAlive(lock.pid)) {
        throw new Error(
          `Another checks process appears active (pid ${lock.pid}, started ${lock.startedAt}).`,
        );
      }
      fs.unlinkSync(lockPath);
      logLine(
        `Recovered stale lock from pid ${lock.pid} started ${lock.startedAt}.`,
      );
    } catch (error) {
      if (
        String(error.message).includes("Another checks process appears active")
      ) {
        throw error;
      }
      fs.unlinkSync(lockPath);
      logLine("Recovered unreadable stale lock file.");
    }
  }

  fs.writeFileSync(
    lockPath,
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
  }
}

async function sleep(ms) {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

async function executeCycle({
  threshold,
  profile,
  profileConfig,
  previousSignature,
  popupOnFailure,
  updateLatestForRun,
  forceRun,
}) {
  const pendingFiles = getPendingFiles();
  const currentSignature = buildSignature(pendingFiles);
  const report = createBaseReport({ pendingFiles, threshold, profile });
  if (forceRun) {
    report.ready = true;
    report.forceRun = true;
  }

  if (!report.ready) {
    report.skippedReason = `pending_file_count_below_threshold_${threshold}`;
    setCommitDecision(report, false, "minimum_pending_file_threshold_not_met");
    // Do not overwrite latest pass/fail result with a skip-only heartbeat.
    appendReport(report, { updateLatest: false });
    logLine(
      `Skipped: ${pendingFiles.length} pending file(s). Need at least ${threshold}.`,
    );
    return {
      signature: currentSignature,
      outcome: "skipped",
      report,
    };
  }

  if (!forceRun && currentSignature === previousSignature) {
    report.skippedReason = "no_pending_file_change_since_last_run";
    setCommitDecision(
      report,
      false,
      "no_new_check_run_for_current_pending_snapshot",
    );
    // Keep latest.json/latest-summary.md pinned to last real run result.
    appendReport(report, { updateLatest: false });
    logLine("Skipped: pending files unchanged since last completed run.");
    return {
      signature: currentSignature,
      outcome: "skipped",
      report,
    };
  }

  logLine(
    `Running checks (${profile}) with ${pendingFiles.length} pending file(s).`,
  );
  report.stepRun = runProfileSteps(profileConfig);
  setCommitDecision(
    report,
    report.stepRun.success,
    report.stepRun.success
      ? "all_checks_passed_for_current_pending_snapshot"
      : "checks_failed_for_current_pending_snapshot",
  );
  appendReport(report, { updateLatest: updateLatestForRun });
  if (report.stepRun.success) {
    logLine("Checks passed.");
  } else {
    logLine("Checks failed. See reports/tests-checks/latest.json.");
    if (popupOnFailure) {
      showFailurePopup(pendingFiles.length, profile);
    }
  }
  return {
    signature: currentSignature,
    outcome: report.stepRun.success ? "passed" : "failed",
    report,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { absolutePath, config } = loadConfig(options.configPath);
  const profileConfig = config.profiles?.[options.profile];
  if (!profileConfig) {
    throw new Error(
      `Unknown profile "${options.profile}". Available: ${Object.keys(
        config.profiles ?? {},
      ).join(", ")}`,
    );
  }

  const threshold = options.threshold ?? config.threshold ?? DEFAULT_THRESHOLD;
  const intervalMs =
    options.intervalMs ?? config.watchIntervalMs ?? DEFAULT_INTERVAL_MS;
  const popupOnFailure = config.notifications?.popupOnFailure ?? true;
  const defaultConfigPath = path.join(rootDir, DEFAULT_CONFIG_PATH);
  const isDefaultConfig = path.resolve(absolutePath) === defaultConfigPath;
  const updateLatestForRun = profileConfig.publishLatest ?? isDefaultConfig;

  if (!Number.isInteger(threshold) || threshold <= 0) {
    throw new Error(
      "Invalid threshold in options/config. Use a positive integer.",
    );
  }
  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(
      "Invalid watchIntervalMs in options/config. Use a positive integer.",
    );
  }

  acquireLock();
  process.on("exit", releaseLock);
  process.on("SIGINT", () => {
    releaseLock();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    releaseLock();
    process.exit(143);
  });

  logLine(
    `Started in ${options.mode} mode with profile=${options.profile}, threshold=${threshold}, intervalMs=${intervalMs}, config=${absolutePath}.`,
  );

  let previousSignature = "";
  const initialCycle = await executeCycle({
    threshold,
    profile: options.profile,
    profileConfig,
    previousSignature,
    popupOnFailure,
    updateLatestForRun,
    forceRun: options.forceRun,
  });
  previousSignature = initialCycle.signature;

  if (options.mode === "once") {
    if (initialCycle.outcome === "failed") {
      process.exitCode = 1;
    }
    releaseLock();
    return;
  }

  while (true) {
    await sleep(intervalMs);
    const cycle = await executeCycle({
      threshold,
      profile: options.profile,
      profileConfig,
      previousSignature,
      popupOnFailure,
      updateLatestForRun,
      forceRun: options.forceRun,
    });
    previousSignature = cycle.signature;
  }
}

main().catch((error) => {
  logLine(error.message);
  process.exit(1);
});
