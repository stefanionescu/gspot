import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { generatedEslint } from '#tests/support/cli/generated-eslint.ts';

test.each(['recommended', 'all'])('generated %s lint enforces size limits in test files', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[limits]\nfile_lines = 8\nfunction_lines = 5\nstatements = 3\n`,
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
        expect(defect.flatMap((file) => file.messages).some((message) => message.ruleId === rule)).toBe(true);
    const corrected = await eslint.lintText('export function count() { return 1; }\n', {
        filePath: 'sample.test.js',
    });
    expect(
        corrected.flatMap((file) => file.messages).filter((message) => rules.has(message.ruleId ?? '')),
    ).toStrictEqual([]);
});

test.each(['recommended', 'all'])(
    'generated %s structural rules include declared root and nested entries',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[tools.knip]\nentry = ["main.js"]\n[[scope]]\npath = "app"\nconfigurations = []\n[scope.tools.knip]\nentry = ["main.js"]\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'main.js': '',
            'app/main.js': '',
        });
        const eslint = await generatedEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            const defect = await eslint.lintText('export function start() { return launch(); }', { filePath });
            const rules = defect.flatMap((file) => file.messages).map((message) => message.ruleId);
            expect(rules).toContain('gspot/no-trivial-files');
            expect(rules).toContain('gspot/no-trivial-functions');
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
        }
    },
);

test.each(['recommended', 'all'])('generated %s ESLint enforces an explicit types directory', async (level) => {
    await using sandbox = await testdir();
    const source = 'export type Value = string;\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript"]\n[architecture]\ntypes_directory = "contracts"\n[rules]\ninstall = false\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
        'value.ts': source,
        'contracts/value.ts': source,
    });
    const eslint = await generatedEslint(sandbox.path);
    const defect = await eslint.lintFiles(['value.ts']);
    expect(
        defect.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/types-placement'),
    ).toMatchObject([{ severity: 2, line: 1, column: 8, messageId: 'aliasOutside' }]);
    const corrected = await eslint.lintFiles(['contracts/value.ts']);
    expect(
        corrected.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/types-placement'),
    ).toStrictEqual([]);
});
