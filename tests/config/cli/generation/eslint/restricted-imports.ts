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
[architecture.roles]
stores = ["**/store.js"]
`;

/** JavaScript and TypeScript module forms supported by the default store convention. */
export const STORE_FILES = [
    'src/store.ts',
    'src/stores/cart.tsx',
    'src/store/cart.mts',
    'src/cart.store.cts',
    'src/store.js',
    'src/stores/cart.jsx',
    'src/store/cart.mjs',
    'src/cart.store.cjs',
];
