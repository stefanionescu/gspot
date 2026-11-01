import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { TrivialFilesOptions } from '#eslint-plugin/types/rules.ts';

buildRuleTester().run<
    keyof (typeof plugin.rules)['no-trivial-files']['meta']['messages'],
    [Partial<TrivialFilesOptions[0]>]
>('no-trivial-files', plugin.rules['no-trivial-files'], {
    valid: [
        'import "./polyfills.js"; import "./app.js";',
        'import "./owner";',
        '#!/usr/bin/env bun\nimport "./owner";',
        'export const PORT = process.env.PORT; export const HOST = process.env.HOST;',
        'import { loadConfig } from "./config"; export const port = loadConfig().port;',
        'export const ROOT = import.meta.dirname;',
        'export class Money { double() { return this.amount * 2; } }',
        'class Money { double() { return this.amount * 2; } } export { Money };',
        {
            code: 'import type { A } from "a"; declare const plugin: A & { rules: Record<string, unknown> }; export default plugin;',
            filename: '/repo/src/plugin.d.ts',
        },
        'import type { Plugin } from "./owner"; declare const plugin: Plugin; export default plugin;',
        'import { z } from "zod"; import { NAMES } from "./config"; export const schema = z.enum(NAMES);',
        'import { z } from "zod"; import { NAMES } from "./config"; export const result = z.parse(NAMES);',
        'export function run() { return owner(); }',
        'export function run() { return 1; }',
        'export function heading() { return `constant`; }',
        'export const callback = () => 1;',
        'import { run } from "./owner"; run();',
        'await run();',
        'new Owner(...args);',
        'defineProps<{}>();',
        'declare function run(): void;',
        'interface Empty {}',
        'class Empty { value = owner; }',
        'export class Settings { constructor(public enabled: boolean) {} }',
        'export const LIMIT = 2;',
        'export const settings = { enabled: true };',
        'export default ({ enabled: true } satisfies Settings);',
        'export type Settings = { enabled: boolean };',
        'import type { z } from "zod"; import type { schema } from "./schema"; export type Settings = z.infer<typeof schema>;',
        {
            name: 'index re-export allowed at index-only',
            code: 'export * from "./owner";',
            filename: '/repo/src/index.ts',
            options: [{ reexports: 'index-only' }],
        },
        {
            name: 'named index re-export allowed at index-only',
            code: 'export { value } from "./owner";',
            filename: '/repo/src/nested/index.ts',
            options: [{ reexports: 'index-only' }],
        },
        {
            code: 'export * as owner from "./owner";',
            filename: '/repo/src/nested/index.js',
            options: [{ reexports: 'index-only' }],
        },
        {
            name: 'an index file at its export limit',
            code: 'export { a, b } from "./owner"; export * from "./other";',
            filename: '/repo/src/index.ts',
            options: [{ reexports: 'index-only', indexExports: 3 }],
        },
        {
            name: 'an index file that declares as many names as it exports',
            code: 'const a = 1, b = 2, c = 3; export { a, b, c };',
            filename: '/repo/src/index.ts',
            options: [{ reexports: 'index-only', indexExports: 2 }],
        },
        {
            name: 'a route file may only forward',
            code: 'import Page from "../shared/page"; export default Page;',
            filename: '/repo/app/about/page.tsx',
            options: [{ forwardingFiles: ['**/page.tsx'] }],
        },
        {
            name: 'a type-only star export does not count toward the index limit',
            code: 'export type * from "./owner"; export type * from "./other";',
            filename: '/repo/src/index.ts',
            options: [{ reexports: 'index-only', indexExports: 1 }],
        },
    ],
    invalid: [
        'import source from "./source.ts"; export = source;',
        'import { z } from "zod"; export const alias = z;',
        'import { run } from "./owner"; export const alias = run;',
        'import { owner } from "./owner"; export const name = owner.name;',
        'import { owner } from "./owner"; const alias = owner; export default alias;',
        'import { value } from "./owner"; export { value };',
        'import { owner } from "./owner"; export default (owner as Owner)!;',
        'import { owner } from "./owner"; export default (owner satisfies Owner);',
        'export type Alias = Owner;',
        'export type Alias<T> = Owner<T>;',
    ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
});

buildRuleTester().run<
    keyof (typeof plugin.rules)['no-trivial-files']['meta']['messages'],
    [Partial<TrivialFilesOptions[0]>]
>('no-trivial-files re-exports', plugin.rules['no-trivial-files'], {
    valid: [],
    invalid: [
        { code: 'export { value } from "./owner";', errors: [{ messageId: 'reexport' }] },
        { code: 'export * from "./owner";', errors: [{ messageId: 'reexport' }] },
        {
            name: 'an index file re-exports at none',
            code: 'export * from "./owner";',
            filename: '/repo/src/index.ts',
            errors: [{ messageId: 'reexport' }],
        },
        {
            name: 'a file that is not an index re-exports at index-only',
            code: 'export * from "./owner";',
            filename: '/repo/src/owner-list.ts',
            options: [{ reexports: 'index-only' }],
            errors: [{ messageId: 'reexport' }],
        },
        {
            name: 'each re-export reports once, and a renamed re-export too',
            code: 'export { value as alias } from "./owner";\nexport * from "./other";',
            errors: [
                { messageId: 'reexport', line: 1 },
                { messageId: 'reexport', line: 2 },
            ],
        },
        {
            name: 'a re-export beside forwarding imports reports both',
            code: 'import { a } from "./a"; export const b = a; export * from "./other";',
            errors: [{ messageId: 'trivial' }, { messageId: 'reexport' }],
        },
        {
            name: 'a route file that may only forward still reports a re-export',
            code: 'export { default } from "../shared/page";',
            filename: '/repo/app/about/page.tsx',
            options: [{ forwardingFiles: ['**/page.tsx'] }],
            errors: [{ messageId: 'reexport' }],
        },
        {
            name: 'an index file over its export limit',
            code: 'export { a, b } from "./owner"; export * from "./other";',
            filename: '/repo/src/index.ts',
            options: [{ reexports: 'index-only', indexExports: 2 }],
            errors: [{ messageId: 'barrel', data: { count: 3, limit: 2 } }],
        },
    ],
});

buildRuleTester().run('no-trivial-files regressions', plugin.rules['no-trivial-files'], {
    valid: [
        {
            code: 'export type Tree = ReadonlyArray<Tree>;',
            name: 'a recursive type is not forwarding',
        },
        {
            code: "import type { Box, User } from './types';\nexport type UserBox = Box<User>;",
            name: 'a specialized generic is not forwarding',
        },
        'const owner = { value: 0 };\nexport const snapshot = owner.value;\nowner.value = 1;',
    ],
    invalid: [],
});
