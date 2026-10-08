import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { ComputedEslint } from '#tests/types/generation/configuration-files.ts';

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
        const findings = await eslint.lintText('missing();', { filePath });
        expect(findings.flatMap(({ messages }) => messages).some(({ ruleId }) => ruleId === 'no-undef')).toBe(true);
    }
    expect(await eslint.isPathIgnored('emitted/check.js')).toBe(true);
});

test.each(['recommended', 'all'])(
    'generated %s lint applies size limits in test files only at level all',
    async (level) => {
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
        const findings = await eslint.lintText(source, { filePath: 'sample.test.js' });
        for (const rule of rules)
            expect(findings.flatMap((file) => file.messages).some((diagnostic) => diagnostic.ruleId === rule)).toBe(
                level === 'all',
            );
    },
);

test.each(['recommended', 'all'])(
    'generated %s structural rules apply to root and nested files only at level all',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                tables: '[scope."app"]\nconfigurations = ["javascript"]\n',
                level: level,
            }),
            'package.json': '{"private":true,"type":"module"}\n',
            'main.js': '',
            'app/main.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            const findings = await eslint.lintText('export function start() { return launch(); }', { filePath });
            const rules = new Set(findings.flatMap((file) => file.messages).map((diagnostic) => diagnostic.ruleId));
            expect(rules.has('gspot/no-trivial-files')).toBe(level === 'all');
            expect(rules.has('gspot/no-trivial-functions')).toBe(false);
            const local = await eslint.lintText('function start() { return launch(); } export const app = start();', {
                filePath,
            });
            expect(
                local.flatMap(({ messages }) => messages).some(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
            ).toBe(level === 'all');
        }
    },
);

test.each(['recommended', 'all'])(
    '%s exempts JSON attributes from declared JavaScript import extensions in root and nested scopes',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                tables: '[tools.eslint]\nimport_extensions = {"**/*" = "js"}\n[scope."app"]\nconfigurations = ["javascript"]\n',
                level,
            }),
            'package.json': '{"private":true,"type":"module","imports":{"#manifest":"./package.json"}}\n',
            'main.js': '',
            'app/main.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            const config = (await eslint.calculateConfigForFile(filePath)) as ComputedEslint;
            expect(config.rules['gspot/import-extensions']![0]).toBe(2);
            const ordinary = await eslint.lintText('import manifest from "#manifest";', { filePath });
            expect(
                ordinary
                    .flatMap((file) => file.messages)
                    .filter(({ ruleId, fatal }) => ruleId === 'gspot/import-extensions' || fatal === true)
                    .map(({ ruleId, line }) => ({ ruleId, line })),
            ).toStrictEqual([{ ruleId: 'gspot/import-extensions', line: 1 }]);
            const metadata = await eslint.lintText('import manifest from "#manifest" with { type: "json" };', {
                filePath,
            });
            expect(
                metadata
                    .flatMap((file) => file.messages)
                    .filter(({ ruleId, fatal }) => ruleId === 'gspot/import-extensions' || fatal === true),
            ).toStrictEqual([]);
        }
    },
);
