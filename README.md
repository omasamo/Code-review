# Tinnitus Tracker review

A standalone companion to [kamil12345/tinnitus-app](https://github.com/kamil12345/tinnitus-app): the full code review from 5–6 October 2026 as an interactive dashboard, plus a quality scanner that re-reviews new changes to the app against the same checklist. Nothing here touches the app repository.

- `docs/` – the GitHub Pages site (plain HTML/JS, no build step)
- `docs/data/findings.json` – every finding (A1–A178 evidence appendix, L1–L17 legal review, S-numbers added later) with its status and history
- `docs/data/overview.json` – the council verdict, top 10 and plan for the "At a glance" page
- `reports/` – the original markdown reports the data was generated from
- `scripts/` – importer, scanner, issue sync, local preview server
- `.github/workflows/` – on-demand scan and issue sync

## Enable GitHub Pages (once)

1. Push this repository to GitHub.
2. Repository **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, branch `main`, folder `/docs`. Save.
3. The site appears at `https://<owner>.github.io/<repo>/` after a minute or two.

The page reads `docs/data/*.json`, so any commit that changes those files updates the site on the next push.

## Open and close findings

Status lives in two places that the scripts keep in step:

- **`docs/data/findings.json`** – the source of truth for `fixed` (set by the scanner when a finding's code is gone).
- **GitHub Issues on this repository** – one issue per finding, labelled `finding`, `id:A1`, `severity:…`, `category:…`. Anyone can close or reopen an issue on GitHub; the dashboard shows the live issue state, and the sync workflow writes it back to the data file. New issues labelled `finding` are imported as the next `S` number.

To turn that on after the first push:

```bash
# docs/config.json → "reviewRepo": "<owner>/<repo>", "issuesEnabled": true
npm run sync-issues          # creates ~195 issues (dry-run first: node scripts/sync-issues.mjs --dry-run)
git commit -am "Enable issues" && git push
```

On every findings list each row has a tick box and a **Generate prompt to fix chosen issues** button (also "Select all shown"); it produces a ready-to-paste prompt for Claude Code or any coding assistant opened in the app repo, with the rules and the full text of the chosen findings.

On the dashboard, **Settings** takes an optional fine-grained personal access token (Issues: read and write on this repo, stored only in that browser) so you can close, reopen and create issues without leaving the page. Without a token the buttons link to GitHub.

Without issues enabled, change status from the command line:

```bash
node scripts/scan.mjs set-status A12 closed "Decided: keep as is"
```

## Run the quality scanner

The scanner diffs the app repository from the last scanned commit (initially the reviewed commit `5513c30`) to `HEAD`, sends the diff plus the full changed files and the open findings that touch them to Claude, then:

- marks findings **fixed** when the change removes or corrects their code,
- adds **new** findings in the same format and severity scale,
- records the scan under `scans` in the data file and advances `scannedCommit`.

```bash
cd ~/Documents/tinnitus-app-review
npm install                       # once; only needed for the api backend
npm run scan                      # app repo auto-detected at ../tinnitus-app
node scripts/scan.mjs scan --repo /path/to/tinnitus-app --base 5513c30 --head main
git commit -am "Quality scan" && git push      # updates the dashboard
```

Three ways to reach Claude, picked automatically (`--backend` or `SCAN_BACKEND` to force):

| backend | needs | notes |
|---|---|---|
| `api` | `ANTHROPIC_API_KEY` (or `ant auth login`) | default model `claude-opus-5-5`; `SCAN_MODEL` or `--model` to change |
| `cli` | Claude Code CLI on `PATH` (or `CLAUDE_BIN`) | uses your Claude subscription, no key |
| `prompt` | nothing | writes `.scan/prompt-<sha>.md`; have any Claude session answer it with JSON, then `node scripts/scan.mjs ingest answer.json --head <sha>` |

From a Claude Code session in this folder, "run the quality scan" means: run `node scripts/scan.mjs scan --backend prompt`, answer the prompt (the session can read the app repo itself), ingest the answer, commit and push.

Other commands:

```bash
npm run check                     # no Claude: lists open findings whose file no longer exists
node scripts/scan.mjs add --title "…" --severity high --category bug --file app/x.ts:12 --what "…"
node scripts/scan.mjs scan --dry-run      # writes the prompt to .scan/last-prompt.md without calling anything
npm run serve                     # preview the dashboard at http://localhost:8766/
npm run import                    # regenerate data from reports/ (keeps existing statuses)
```

## GitHub Actions

- **Quality scan** (`workflow_dispatch`): checks out the app repo, runs the scan with the `api` backend, syncs issues and commits the data. Needs two repository secrets: `ANTHROPIC_API_KEY`, and `APP_REPO_TOKEN` (a fine-grained PAT with *Contents: read* on the private app repo).
- **Sync issues**: runs when an issue is opened, closed or reopened, and nightly. Needs no secrets.

## Data model

```jsonc
{
  "id": "A10",                    // A = evidence appendix, L = legal review, S = scanner/manual
  "title": "…", "severity": "high", "category": "bug",
  "file": "app/db/queries.ts", "line": 334, "verifiers": "3/3",
  "what": "…", "evidence": "…", "goesWrong": "…", "fix": "…",
  "source": "review-2026-10-05", "commit": "5513c30",
  "status": "open" | "fixed" | "closed",
  "issue": 12,                    // GitHub issue number once synced
  "history": [{ "at": "…", "status": "fixed", "note": "…", "commit": "…" }]
}
```
