// Authored restrictions and the store convention exercise the same native ESLint rule.
export const PROJECT = {
    'package.json': '{"name":"restricted-imports","private":true,"type":"module","dependencies":{"zustand":"5.0.8"}}',
    'src/widget.js':
        'import { create } from "zustand";\nimport { readFile } from "node:fs";\nexport const widget = create(() => ({ readFile }));\n',
    'src/store.js':
        'import { create } from "zustand";\nimport { readFile } from "node:fs";\nexport const store = create(() => ({ readFile }));\n',
};

export const POLICY = `[agent_rules]
enabled = false
[tools.eslint]
restricted_imports = [{ name = "node:fs", message = "Use the storage service." }]
[zustand]
store_files = ["**/store.js"]
`;

/** JavaScript and TypeScript module forms supported by the default store convention. */
export const STORE_EXTENSIONS = ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'];
