# Development & Build Commands

All commands should be run from the project root directory.

## Install Dependencies

```bash
npm install
```

## Compile TypeScript

```bash
npm run compile
```

## Watch for Changes (Auto-compile)

```bash
npm run watch
```

## Package Extension (VSIX)

```bash
npm run package
```

This produces a `.vsix` file in the project root.

## Publish Extension

```bash
npm run publish
```

## Uninstall Agents

```bash
npm run vscode:uninstall
```

## Clean Build Artifacts

To clean build files manually, remove the following:
- `out/` directory
- Any `*.js`, `*.js.map`, `*.tsbuildinfo` files
- `node_modules/.cache` (if present)