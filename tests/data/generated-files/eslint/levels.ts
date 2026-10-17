export const COALESCING_SOURCE = `export function fallback(value) {
    const alternate = value || {};
    return alternate ?? {};
}
export const known = (value) => value ?? { known: true };
`;

export const COALESCING_FIXED = `export function fallback(value) {
    if (value === undefined) return;
    return value;
}
export const known = (value) => value ?? { known: true };
`;

export const TYPE_EXPORT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["index.ts","value.ts"]}\n',
    'value.ts': 'export type Shape = { name: string };\nexport const value: Shape = { name: "example" };\n',
    'index.ts':
        'import { value, Shape } from "./value.js";\nexport { value };\nexport { Shape } from "./value.js";\nexport const shape: Shape = value;\n',
} as const;
