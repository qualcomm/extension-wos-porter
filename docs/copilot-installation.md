# Installation — VS Code / GitHub Copilot Extension

## Prerequisites

- [Visual Studio 2022](https://visualstudio.microsoft.com/) with the **MSVC v143 - ARM64/ARM64EC build tools** and **Windows 11 SDK**
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
- VS Code 1.100+
- `git` on PATH

## Install from VSIX (Releases)

1. Download the latest `.vsix` from the [Releases page](https://github.com/qualcomm/extension-wos-porter/releases)
2. In VS Code, open the Extensions view (`Ctrl+Shift+X`) → click the `...` menu → select **"Install from VSIX..."** → choose the downloaded file
3. Reload VS Code when prompted

## Install from source

If you want to build and install from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/qualcomm/extension-wos-porter.git
   cd extension-wos-porter
   ```

2. Install dependencies and package:
   ```bash
   npm install
   npm run package
   ```

3. Install the generated `.vsix`:
   ```bash
   code --install-extension wos-porter-<version>.vsix
   ```

4. Reload VS Code when prompted.

## Usage

1. Open Copilot Chat
2. Select the **wos-porter** agent from the agent picker
3. Paste a GitHub repository URL or a local path to an x64 project:

```
Port https://github.com/user/repo to ARM64
```

or

```
Port C:\src\my-x64-project to ARM64
```

The agent will analyze it, port it, build it, and produce a patch — all automatically.

### Other agents

You can also invoke individual agents directly:

- **wos-builder** — Build and validate an already-ported project
- **wos-tester** — Run and fix ARM64 test suites and benchmarks
- **wos-optimizer** — Apply ARM NEON intrinsics to hot kernels