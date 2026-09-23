import { tester } from '#tests/support/plugin/tester.ts';
import { noTrivialFiles } from '#plugin/rules/no-trivial-files.ts';

tester().run('no-trivial-files', noTrivialFiles, {
    valid: [
        'export function work() { first(); second(); third(); }',
        'export const schema = z.object({ name: z.string() });',
        'export interface Settings { name: string; }',
        'export const settings = { enabled: true };',
        'defineProps<{ name: string }>();',
        'export const schema = define<{ enabled: boolean; paths: string[] }>();',
    ],
    invalid: [
        'export { value } from "./owner";',
        'import { run } from "./owner"; run();',
        'import { run } from "./owner"; export const alias = run;',
        'export function run() { return owner(); }',
        'export const callback = () => 1;',
        'class A { method() { return 1; } }',
        'defineProps<ExistingProps>();',
        'defineProps<{}>();',
    ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
});

tester().run('no-trivial-files at root and nested entry paths', noTrivialFiles, {
    valid: [],
    invalid: [
        {
            code: 'import { start } from "./start"; start();',
            filename: '/repo/src/task.js',
            errors: [{ messageId: 'trivial' }],
        },
        {
            code: 'import { start } from "./start"; start();',
            filename: '/repo/app/src/main.js',
            errors: [{ messageId: 'trivial' }],
        },
    ],
});
