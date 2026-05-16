# Agent notes (humans and AI tools)

## Repository paths

When referring to files in this project—in commits, pull requests, issues, documentation, or review comments—use **paths from the repository root** (`apps/...`, `packages/...`, `docs/...`). Avoid machine-specific absolute paths (for example `C:\Users\...` or `/Users/.../Downloads/...`) in anything that is shared or committed.

Cursor picks up the same rule for in-IDE agents via `.cursor/rules/repo-relative-paths.mdc` (`alwaysApply: true`).

## Default work direction

When there is **no new or specific instruction**, continue from **`docs/full-build-plan.md`** — phased roadmap (1–14), checkpoints, and scope order there are **authoritative**. Prefer the next unchecked or in-progress slice over inventing unrelated work; revise that doc when product scope changes.

Cursor mirrors this via `.cursor/rules/follow-full-build-plan.mdc` (`alwaysApply: true`).

## Source hygiene (comments, logs, stray text)

- **Comments** explain *why* or non-obvious invariants—not a tutorial, not a chat, not a copy of `docs/full-build-plan.md`. Prefer clear names and types over prose. Avoid filler words (“actually”, “simply”, “just”) in comments.
- **No ad-hoc `console.log` / `console.debug` for debugging** in committed code. Small HTTP servers in `apps/api` use **structured JSON on one line** (`console.log(JSON.stringify({ level, event, ... }))`) for listen/shutdown—that pattern is intentional operations logging, not scratch text.
- **User-facing copy** belongs in UI strings or shared copy modules; avoid random placeholder sentences in logic paths (tests and demos may use minimal fixtures).
- **Before merge:** skim the diff for stray prose, duplicated doc blocks, or half-finished sentences in comments or strings.

Cursor: `.cursor/rules/source-hygiene.mdc` (`alwaysApply: true`).
