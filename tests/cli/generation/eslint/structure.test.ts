import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { APP_KNIP } from '#tests/config/cli/generation/eslint/structure.ts';

test('generated all lint checks authored directories named after build outputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns these outputs."\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tests/build/check.js': 'missing();',
        'src/dist/check.js': 'missing();',
        'coverage/check.js': 'missing();',
        'emitted/check.js': 'missing();',
    });
    const eslint = await createEslint(sandbox.path);
    for (const filePath of ['tests/build/check.js', 'src/dist/check.js', 'coverage/check.js']) {
        expect(await eslint.isPathIgnored(filePath)).toBe(false);
        const defect = await eslint.lintText('missing();', { filePath });
        expect(defect.flatMap(({ messages }) => messages).some(({ ruleId }) => ruleId === 'no-undef')).toBe(true);
        const corrected = await eslint.lintText('export const answer = 1;', { filePath });
        expect(
            corrected.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'no-undef'),
        ).toStrictEqual([]);
    }
    expect(await eslint.isPathIgnored('emitted/check.js')).toBe(true);
    const malformed = await eslint.lintText('export const value = ;', { filePath: 'tests/build/check.js' });
    expect(malformed.flatMap(({ messages }) => messages).some(({ fatal, line }) => fatal === true && line === 1)).toBe(
        true,
    );
});

test.each(['recommended', 'all'])('generated %s lint enforces size limits in test files', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[limits]\nfile_lines = 8\nfunction_lines = 5\nstatements = 3\n',
            level: level,
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'sample.test.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const rules = new Set(['max-lines', 'max-lines-per-function', 'max-statements']);
    const declarations = Array.from(
        { length: 9 },
        (_, index) => `    const value${String(index)} = ${String(index)};`,
    ).join('\n');
    const source = `export function count() {\n${declarations}\n    return value0;\n}\n`;
    const defect = await eslint.lintText(source, { filePath: 'sample.test.js' });
    for (const rule of rules)
        expect(defect.flatMap((file) => file.messages).some((diagnostic) => diagnostic.ruleId === rule)).toBe(
            level === 'all',
        );
    const corrected = await eslint.lintText('export function count() { return 1; }\n', {
        filePath: 'sample.test.js',
    });
    expect(
        corrected.flatMap((file) => file.messages).filter((diagnostic) => rules.has(diagnostic.ruleId ?? '')),
    ).toStrictEqual([]);
});

test.each(['recommended', 'all'])(
    'generated %s structural rules include declared root and nested entries',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], { tables: APP_KNIP, level: level }),
            'package.json': '{"private":true,"type":"module"}\n',
            'main.js': '',
            'app/main.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            const defect = await eslint.lintText('export function start() { return launch(); }', { filePath });
            const rules = new Set(defect.flatMap((file) => file.messages).map((diagnostic) => diagnostic.ruleId));
            expect(rules.has('gspot/no-trivial-files')).toBe(level === 'all');
            expect(rules.has('gspot/no-trivial-functions')).toBe(false);
            const local = await eslint.lintText('function start() { return launch(); } export const app = start();', {
                filePath,
            });
            expect(
                local.flatMap(({ messages }) => messages).some(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
            ).toBe(level === 'all');
            const corrected = await eslint.lintText(
                'export function start() { const app = launch(); app.configure(); return app.run(); }',
                { filePath },
            );
            expect(
                corrected
                    .flatMap((file) => file.messages)
                    .filter(
                        ({ ruleId }) => ruleId === 'gspot/no-trivial-files' || ruleId === 'gspot/no-trivial-functions',
                    ),
            ).toStrictEqual([]);
            const metadata = await eslint.lintText('import manifest from "#manifest" with { type: "json" };', {
                filePath,
            });
            expect(
                metadata.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/import-extensions'),
            ).toStrictEqual([]);
        }
    },
);
