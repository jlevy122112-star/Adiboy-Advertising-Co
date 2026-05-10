# Version control — enforcement and habits

This repo uses **Git** as the source of truth. Uncommitted work and duplicate folder trees are not recoverable from the tooling alone—**push to a remote regularly**.

## What runs automatically

| Hook / automation | When | What |
|-------------------|------|------|
| **pre-commit** (Husky) | `git commit` | `lint-staged` (ESLint on staged `packages/**/*.ts`) → `scripts/pre-commit-verify.mjs` (typecheck + targeted or full Vitest per staged paths). |
| **pre-push** (Husky) | `git push` | `npm run verify` → `typecheck` → `lint` → `test:packages`. |
| **GitHub Actions** | Push/PR to `main` or `master` | Same logical gate as pre-push on a clean Ubuntu runner (`npm ci`). |

Install hooks after clone: **`npm install`** (runs `prepare` → Husky).

## Habits that prevent “lost work”

1. **One working copy** — Avoid nested `RepoName/RepoName/` duplicates; open the folder that contains the root `package.json` you commit from.
2. **Commit often** — Small commits with clear messages beat long-lived uncommitted batches.
3. **Remote backup** — `git remote add origin <url>` and **`git push`** (`main`/`master`) so local disk loss does not lose history.
4. **Branch protection** (GitHub/GitLab): require PR + passing CI before merge to default branch when the remote exists.

## Bypass (break glass)

Reserved for emergencies; bypassed checks caused the problems hooks exist to catch.

```bash
git commit --no-verify
git push --no-verify
```

---

_See also [`testing-doctrine.md`](./testing-doctrine.md) for manual command parity with CI._
