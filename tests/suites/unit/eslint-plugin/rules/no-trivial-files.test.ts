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
            name: 'index forwarding allowed by allowIndex',
            code: 'export * from "./owner";',
            filename: '/repo/src/index.ts',
            options: [{ allowIndex: true }],
        },
        {
            name: 'named index forwarding allowed by allowIndex',
            code: 'export { value } from "./owner";',
            filename: '/repo/src/nested/index.ts',
            options: [{ allowIndex: true }],
        },
        {
            code: 'export * as owner from "./owner";',
            filename: '/repo/src/nested/index.js',
            options: [{ allowIndex: true }],
        },
    ],
    invalid: [
        {
            name: 'non-index forwarding despite allowIndex',
            code: 'export * from "./owner";',
            filename: '/repo/src/owner-list.ts',
            options: [{ allowIndex: true }] as [{ allowIndex: boolean }],
        },
        'import source from "./source.ts"; export = source;',
        'import { z } from "zod"; export const alias = z;',
        'import { run } from "./owner"; export const alias = run;',
        'import { owner } from "./owner"; export const name = owner.name;',
        'import { owner } from "./owner"; const alias = owner; export default alias;',
        { name: 'named forwarding without allowIndex', code: 'export { value } from "./owner";' },
        { name: 'forwarding without a named filename', code: 'export * from "./owner";' },
        'import { value } from "./owner"; export { value };',
        'import { owner } from "./owner"; export default (owner as Owner)!;',
        'import { owner } from "./owner"; export default (owner satisfies Owner);',
        'export type Alias = Owner;',
        'export type Alias<T> = Owner<T>;',
        {
            name: 'index forwarding without allowIndex',
            code: 'export * from "./owner";',
            filename: '/repo/src/index.ts',
        },
    ].map((row) => ({
        ...(typeof row === 'string' ? { code: row } : row),
        errors: [{ messageId: 'trivial' as const }],
    })),
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
