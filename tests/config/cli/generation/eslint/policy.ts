export const COALESCING_SOURCE = `export function fallback(value) {
    const alternate = value || {};
    return alternate ?? {};
}
export const known = (value) => value ?? { known: true };
`;

export const COALESCING_CORRECTION = `export function fallback(value) {
    if (value === undefined) return;
    return value;
}
export const known = (value) => value ?? { known: true };
`;

export const TYPE_EXPORT_PROJECT = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["index.ts","value.ts"]}\n',
    'value.ts': 'export type Shape = { name: string };\nexport const value: Shape = { name: "example" };\n',
    'index.ts': 'import { value, Shape } from "./value.js";\nexport { value, Shape };\n',
};

export const TYPE_EXPORT_CORRECTION = `import type { Shape } from "./value.js";
import { value } from "./value.js";
export type { Shape };
export { value };
`;

export const SUPPRESSION_PROJECT = {
    'package.json': '{"private":true,"type":"module"}\n',
    'unused.js':
        '// eslint-disable-next-line no-debugger -- reason: Demonstrate an unused directive.\nexport const value = 1;\n',
    'missing.js': '// eslint-disable-next-line no-debugger\ndebugger;\n',
};

export const SUPPRESSION_CORRECTION = {
    'unused.js': 'export const value = 1;\n',
    'missing.js': '// eslint-disable-next-line no-debugger -- reason: Demonstrate a described directive.\ndebugger;\n',
};
