import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { generatedEslint } from '#tests/harness/cli/generated.ts';

const APP_KNIP =
    '[tools.knip]\nentry = ["main.js"]\n[[scope]]\npath = "app"\nkits = []\n[scope.tools.knip]\nentry = ["main.js"]\n';

test('generated all lint checks authored directories named after build outputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['javascript'],
            '[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns these outputs."\n',
            'all',
        ),
        'package.json': '{"private":true,"type":"module"}\n',
        'tests/build/check.js': 'missing();',
        'src/dist/check.js': 'missing();',
        'coverage/check.js': 'missing();',
        'emitted/check.js': 'missing();',
    });
    const eslint = await generatedEslint(sandbox.path);
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
        'gspot.toml': policyOf(['javascript'], '[limits]\nfile_lines = 8\nfunction_lines = 5\nstatements = 3\n', level),
        'package.json': '{"private":true,"type":"module"}\n',
        'sample.test.js': '',
    });
    const eslint = await generatedEslint(sandbox.path);
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
            'gspot.toml': policyOf(['javascript'], APP_KNIP, level),
            'package.json': '{"private":true,"type":"module"}\n',
            'main.js': '',
            'app/main.js': '',
        });
        const eslint = await generatedEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            const defect = await eslint.lintText('export function start() { return launch(); }', { filePath });
            const rules = new Set(defect.flatMap((file) => file.messages).map((diagnostic) => diagnostic.ruleId));
            expect(rules.has('gspot/no-trivial-files')).toBe(level === 'all');
            expect(rules.has('gspot/no-trivial-functions')).toBe(level === 'all');
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
                metadata.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/import-path-style'),
            ).toStrictEqual([]);
        }
    },
);

test.each(['recommended', 'all'])('generated %s ESLint enforces an explicit types directory', async (level) => {
    await using sandbox = await testdir();
    const source = 'export type Value = string;\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['typescript'],
            '[architecture]\ntypes_directory = "contracts"\n[guides]\ninstall = false\n',
            level,
        ),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
        'value.ts': source,
        'contracts/value.ts': source,
        'widths.ts': 'export const widths = { name: 24, description: 80 } as const;\n',
        'mode.ts': 'export const Mode = { Read: "read", Write: "write" } as const;\n',
    });
    const eslint = await generatedEslint(sandbox.path);
    const defect = await eslint.lintFiles(['value.ts']);
    expect(
        defect.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/types-placement'),
    ).toMatchObject(level === 'all' ? [{ severity: 2, line: 1, column: 8, messageId: 'aliasOutside' }] : []);
    const corrected = await eslint.lintFiles(['contracts/value.ts']);
    expect(
        corrected.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/types-placement'),
    ).toStrictEqual([]);
    const records = await eslint.lintFiles(['widths.ts', 'mode.ts']);
    expect(
        records.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/types-placement'),
    ).toMatchObject(level === 'all' ? [{ severity: 2, line: 1, column: 1, messageId: 'enumOutside' }] : []);
});
