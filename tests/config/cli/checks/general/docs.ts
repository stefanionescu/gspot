/** Independent scoped definitions exercise native runner ownership and inheritance. */
export const DOC_TASK_FILES = {
    'root.md':
        'Run `mise run root-mise`, `npm run root-js`, `pnpm run root-js`, `yarn run root-js`, and `bun run root-js`.\nRun `mise run root-js`, `bun run root-mise`, and `npm run child-js`.\n',
    'package.json': '{"private":true,"scripts":{"root-js":"true"}}\n',
    'mise.toml': '[tasks.root-mise]\nrun = "true"\n',
    'app/guide.md':
        'Run `mise run root-mise`, `mise run child-mise`, `npm run child-js`, and `yarn run child-js`.\nRun `npm run root-js` and `bun run sibling-js`.\n',
    'app/package.json': '{"private":true,"scripts":{"child-js":"true"}}\n',
    'app/mise.toml': '[tasks.child-mise]\nrun = "true"\n',
    'app/nested/guide.md': 'Run `npm run child-js` and `bun run child-js`.\n',
    'app/empty/guide.md': 'Run `npm run child-js`.\n',
    'app/empty/package.json': '{"private":true}\n',
    'sibling/guide.md': 'Run `npm run sibling-js`.\nRun `pnpm run child-js` and `mise run child-mise`.\n',
    'sibling/package.json': '{"private":true,"scripts":{"sibling-js":"true"}}\n',
};

/** Scope membership follows authored project boundaries. */
export const DOC_TASK_SCOPES =
    '[agent_rules]\nenabled = false\n[[scope]]\npath = "app"\nconfigurations = []\n[[scope]]\npath = "app/nested"\nconfigurations = []\n[[scope]]\npath = "app/empty"\nconfigurations = []\n[[scope]]\npath = "sibling"\nconfigurations = []\n';

/** Each rejected command identifies its own source document and line. */
export const DOC_TASK_FINDINGS = [
    { file: 'root.md', line: 2, command: 'mise run root-js' },
    { file: 'root.md', line: 2, command: 'bun run root-mise' },
    { file: 'root.md', line: 2, command: 'npm run child-js' },
    { file: 'app/guide.md', line: 2, command: 'npm run root-js' },
    { file: 'app/guide.md', line: 2, command: 'bun run sibling-js' },
    { file: 'app/empty/guide.md', line: 1, command: 'npm run child-js' },
    { file: 'sibling/guide.md', line: 2, command: 'pnpm run child-js' },
    { file: 'sibling/guide.md', line: 2, command: 'mise run child-mise' },
];
