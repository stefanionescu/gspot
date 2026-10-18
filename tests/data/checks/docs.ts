/** The mise tasks and package scripts of each scope, and documents that run them. */
export const DOC_TASK_FILES = {
    'root.md': `Run \`mise run root-mise\`, \`npm run root-js\`, \`pnpm run root-js\`, \`yarn run root-js\`, and \`bun run root-js\`.
Run \`mise run root-js\`, \`bun run root-mise\`, and \`npm run child-js\`.
`,
    'package.json': '{"private":true,"scripts":{"root-js":"true"}}\n',
    'mise.toml': '[tasks.root-mise]\nrun = "true"\n',
    'app/guide.md': `Run \`mise run root-mise\`, \`mise run child-mise\`, \`npm run child-js\`, and \`yarn run child-js\`.
Run \`npm run root-js\` and \`bun run sibling-js\`.
`,
    'app/package.json': '{"private":true,"scripts":{"child-js":"true"}}\n',
    'app/mise.toml': '[tasks.child-mise]\nrun = "true"\n',
    'app/nested/guide.md': 'Run `npm run child-js` and `bun run child-js`.\n',
    'app/empty/guide.md': 'Run `npm run child-js`.\n',
    'app/empty/package.json': '{"private":true}\n',
    'sibling/guide.md': 'Run `npm run sibling-js`.\nRun `pnpm run child-js` and `mise run child-mise`.\n',
    'sibling/package.json': '{"private":true,"scripts":{"sibling-js":"true"}}\n',
} as const;

/** One scope for each project folder. */
export const DOC_TASK_SCOPES = `[[scope]]
path = "app"

configurations = []
[[scope]]
path = "app/nested"

configurations = []
[[scope]]
path = "app/empty"

configurations = []
[[scope]]
path = "sibling"

configurations = []
`;

/** Each rejected command and the document line that holds it. */
export const DOC_TASK_FINDINGS = [
    { file: 'root.md', line: 2, command: 'mise run root-js' },
    { file: 'root.md', line: 2, command: 'bun run root-mise' },
    { file: 'root.md', line: 2, command: 'npm run child-js' },
    { file: 'app/guide.md', line: 2, command: 'npm run root-js' },
    { file: 'app/guide.md', line: 2, command: 'bun run sibling-js' },
    { file: 'app/empty/guide.md', line: 1, command: 'npm run child-js' },
    { file: 'sibling/guide.md', line: 2, command: 'pnpm run child-js' },
    { file: 'sibling/guide.md', line: 2, command: 'mise run child-mise' },
] as const;

/** Only command blocks without a title report paths. */
export const DOC_FENCE_PATH_CASES = [
    { metadata: 'title="example.sh"', language: 'sh', reported: false },
    { metadata: 'title="example.sql"', language: 'sql', reported: false },
    { metadata: 'title="example.custom"', language: 'custom', reported: false },
    { metadata: 'start=1\ttitle="example.sh"', language: 'sh', reported: false },
    { metadata: '', language: 'text', reported: false },
    { metadata: '', language: 'sh', reported: true },
    { metadata: 'notitle="example.sh"', language: 'bash', reported: true },
    { metadata: 'description="title=example.sh"', language: 'console', reported: true },
] as const;

/** The same HTML target supports anchor and text-fragment checks locally and over HTTP. */
export const LINK_PAGE = `<!doctype html>
<html lang="en"><head><title>Setup</title></head><body><h1 id="setup">Setup</h1><p>Current setup.</p></body></html>
`;

/** Child URL exceptions add to the root list but do not cover root links. */
export const LINK_SCOPE_SETTINGS = `[docs]
allowed_urls = { value = ["/root-only$"], reason = "The root guide describes an unavailable endpoint." }
[[scope]]
path = "app"
configurations = []
[scope.docs]
allowed_urls = { value = ["/child-only$"], reason = "The child guide describes an unavailable endpoint." }
`;

/** A missing text fragment, and a fragment that matches the page. */
export const LINK_TEXT_CASES = [
    { fragment: 'absent', failures: [{ scope: '', file: 'root.md', rule: 'ERROR' }] },
    { fragment: 'Current%20setup', failures: [] },
] as const;

// Documents for both the tool checks and the built-in checks.
export const README = `# Test

A sandbox that holds documents and nothing else.

## Requirements

- git

## Setup

\`\`\`bash
git clone https://example.com/example.git
\`\`\`

## Usage

Open the guide and read it from the top.
`;

export const GUIDE = `# The Guide

The worker retries the request three times. Each retry waits one second.
`;

export const LICENSE = `MIT License

Copyright (c) 2026 Alex Garcia
`;

export const DOCS_SETTINGS = `configurations = ["docs"]\n[[scope]]\npath = "api"\n\nconfigurations = ["docs"]\n[[ignore]]\ncheck = "docs/lychee"\npaths = ["api/ignored/**"]\nreason = "These pages are evaluated only after the documentation build."\n`;
