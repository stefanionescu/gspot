import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/rule-tester.ts';
import type { TrivialFilesOptions } from '#eslint-plugin/types/rules.ts';

createRuleTester().run<
    keyof (typeof plugin.rules)['no-trivial-files']['meta']['messages'],
    [Partial<TrivialFilesOptions[0]>]
>('no-trivial-files', plugin.rules['no-trivial-files'], {
    valid: [
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
            code: 'export * from "./owner";',
            filename: '/repo/src/index.ts',
            options: [{ allowIndex: true }],
        },
        {
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
        'import { z } from "zod"; export const alias = z;',
        'import { run } from "./owner"; export const alias = run;',
        'export const name = owner.name;',
        'const alias = owner; export default alias;',
        'export { value } from "./owner";',
        'export * from "./owner";',
        'import { value } from "./owner"; export { value };',
        'import "./owner";',
        '#!/usr/bin/env bun\nimport "./owner";',
        'export default (owner as Owner)!;',
        'export default (owner satisfies Owner);',
        'export type Alias = Owner;',
        'export type Alias<T> = Owner<T>;',
        { code: 'export * from "./owner";', filename: '/repo/src/index.ts' },
    ].map((entry) => ({
        ...(typeof entry === 'string' ? { code: entry } : entry),
        errors: [{ messageId: 'trivial' as const }],
    })),
});
