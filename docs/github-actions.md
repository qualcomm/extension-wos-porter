# Run in the Cloud (GitHub Actions)

> ⚠️ **Cloud workflows work best for smaller, straightforward projects.** For medium or complex projects — those with heavy SIMD, intricate build systems, many failing tests, or projects that need interactive fix cycles — use **[GitHub Copilot locally (VS Code extension)](copilot-installation.md)** or the **[Claude Code plugin](../claude-plugin/README.md)** instead. Local runs give full interactive visibility and the ability to intervene at each phase; cloud runs are unattended and will hit time limits or produce incomplete ports on hard projects.

| Project complexity | Recommended approach |
|---|---|
| Small / straightforward (clean CMake or MSBuild, no SIMD, standard deps) | ✅ GitHub Actions (this guide) |
| Medium (some SIMD, vcpkg deps, a few test failures to fix) | ⚠️ GitHub Actions may work — monitor the run; local preferred |
| Complex (heavy SSE/AVX, custom build system, many test failures, NEON optimization needed) | ❌ Use Claude Code or Copilot locally |

> **Recommended:** Cloud deployment via GitHub Actions is still evolving. For best porting results, run the agent locally using the **GitHub Copilot VS Code extension** or the **Claude Code plugin** — local runs give full interactive visibility and the ability to intervene when needed. Use the workflows below when you don't have a local ARM64 machine or want an automated, unattended run.

Three workflow variants are available — pick the one that matches your credentials:

| Workflow | Best for |
|---|---|
| **[WoS Port — Copilot](../.github/workflows/wos-port-copilot.yml)** | Simplest setup; requires a `COPILOT_GITHUB_TOKEN` secret |
| **[WoS Port — Copilot with x64 baseline](../.github/workflows/wos-port-copilot-x64-arm64.yml)** | Runs an x64 benchmark first, then uses it to guide ARM64 NEON optimizations |
| **[WoS Port — Claude Code](../.github/workflows/wos-port-claude.yml)** | Uses the Anthropic Claude Code backend; requires an `ANTHROPIC_API_KEY` secret |

All three run on a GitHub-hosted **`windows-11-arm`** runner with the preinstalled Visual Studio ARM64 toolchain. Give any of them a repository URL and they clone, analyze, port, build, and upload a ready-to-apply patch as a workflow artifact.

> **Note:** The Claude Code workflow (`wos-port-claude.yml`) is still in development and may require additional checks and improvements before use in production. For a more stable cloud experience, prefer the Copilot workflows.

## 1. Configure the Copilot token (one-time)

The Copilot CLI needs a token with the **Copilot Requests** permission. The
built-in `GITHUB_TOKEN` does **not** carry that scope, so you must supply your own:

1. Create a **fine-grained personal access token (v2)** with the **Copilot Requests**
   permission — GitHub → *Settings* → *Developer settings* → *Fine-grained tokens*.
2. Add it as a **repository secret** named `COPILOT_GITHUB_TOKEN` —
   repo *Settings* → *Secrets and variables* → *Actions* → *New repository secret*.

The workflow fails fast with a clear message if this secret is missing.

## 2. Run the workflow

1. Open the **Actions** tab of this repository.
2. Select **WoS Port (Windows ARM64, Copilot CLI)** in the left sidebar.
3. Click **Run workflow** and fill in the inputs:

   | Input | Required | Default | Description |
   |---|---|---|---|
   | `repo_url` | yes | — | Repository to port (`https://github.com/owner/repo` or `owner/repo`) |
   | `copilot_model` | no | `auto` | Copilot CLI model (`auto`, `claude-sonnet-4.6`, `gpt-5.4`, `claude-haiku-4.5`, `gpt-5.3-codex`, …) |
   | `max_autopilot_continues` | no | `400` | Max autopilot continuation messages before the CLI stops |

4. Click **Run workflow**. The job runs on `windows-11-arm` (timeout 6 hours);
   the preinstalled Visual Studio ARM64 toolchain is used, so there's nothing else
   to set up.

## 3. Collect the results

When the run finishes, open it and download the artifacts from the **Summary** page:

| Artifact | Contents |
|---|---|
| `arm64-port-copilot-<repo>` | `arm64-port.patch` (combined `git apply` patch), per-commit `git format-patch` series, `commits.txt`, `diffstat.txt`, and the `ARM64-PORT.md` report |
| `ported-repo-copilot-<repo>` | The full working tree on the `arm64-port` branch (build outputs excluded) |
| `copilot-run-log` | The Copilot CLI JSONL run log for inspection |

Apply the patch to a local checkout of the target repo:

```bash
git checkout -b arm64-port
git apply arm64-port.patch
```

The porter only ever works on an `arm64-port` branch forked from the target repo's
default branch — `main`/`master` is never modified. Artifacts are uploaded even if
the run fails partway, so you always have something to inspect.