import { tester } from '#plugin-tests/harness/tester.ts';
import { noTrivialFiles } from '#plugin/rules/no-trivial-files.ts';

tester().run('no-trivial-files', noTrivialFiles, {
    valid: [
        'export function work() { first(); second(); third(); }',
        'export const schema = z.object({ name: z.string() });',
        'export interface Settings { name: string; }',
        'export const settings = { enabled: true };',
    ],
    invalid: [
        'export { value } from "./owner";',
        'import { run } from "./owner"; run();',
        'import { run } from "./owner"; export const alias = run;',
        'export function run() { return owner(); }',
        'export const callback = () => 1;',
        'class A { method() { return 1; } }',
    ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
});
