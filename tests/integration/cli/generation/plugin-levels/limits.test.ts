import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';

test.each(['recommended', 'all'])(
    'generated %s lint checks authored directories named after build outputs',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns these outputs."\n`,
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
        expect(
            malformed.flatMap(({ messages }) => messages).some(({ fatal, line }) => fatal === true && line === 1),
        ).toBe(true);
    },
);

test.each(['recommended', 'all'])('generated %s lint preserves JavaScript class comments', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'counter.js': '',
    });
    const eslint = await generatedEslint(sandbox.path);
    const source =
        "import { value } from './value.js';\n\n// Describes the counter.\nexport class Counter { value = value; }\n";
    const accepted = await eslint.lintText(source, { filePath: 'counter.js' });
    expect(
        accepted
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'gspot/header-comments-before-imports'),
    ).toStrictEqual([]);
    const defect = await eslint.lintText(
        source.replace('// Describes the counter.\n', '// Describes the counter.\n\n\n'),
        { filePath: 'counter.js' },
    );
    expect(
        defect
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'gspot/header-comments-before-imports')
            .map(({ line, messageId: diagnostic }) => ({ line, messageId: diagnostic })),
    ).toStrictEqual(level === 'all' ? [{ line: 3, messageId: 'headerFirst' }] : []);
});

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
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[tools.knip]\nentry = ["main.js"]\n[[scope]]\npath = "app"\nconfigurations = []\n[scope.tools.knip]\nentry = ["main.js"]\n`,
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
            const callbacks = await eslint.lintText(
                'const forward = (signal) => child.kill(signal); process.on("SIGTERM", forward); process.removeListener("SIGTERM", forward);',
                { filePath },
            );
            expect(
                callbacks
                    .flatMap((file) => file.messages)
                    .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
            ).toMatchObject(level === 'all' ? [{ line: 1, column: 17, messageId: 'trivial' }] : []);
            const nested = await eslint.lintText(
                'export function start(items) { return items.map(item => { inspect(item); validate(item); return item; }); }',
                { filePath },
            );
            expect(
                nested
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
            const factory = await eslint.lintText(
                'export function schema(properties) { return configure({ type: "object", properties }); }',
                { filePath },
            );
            expect(
                factory.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/no-trivial-files'),
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
