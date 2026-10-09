import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';

import {
    JSDOC_RULES,
    JSDOC_PROJECT,
    JSDOC_FINDINGS,
    JSDOC_CORRECTION,
    JSDOC_COMPILER_ARGV,
} from '#tests/config/cli/generation/eslint/jsdoc-types.ts';

test.each(['recommended', 'all'])(
    'generated %s ESLint permits JavaScript type documentation and rejects duplicate TypeScript type tags',
    async (level) => {
        await using sandbox = await testdir();
        const description =
            '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\n';
        const typescript = 'export function measure(value: string): number { return value.length; }\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], { level: level }),
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
            'client.ts': description + typescript,
            'client.js': description + 'export function measure(value) { return value.length; }\n',
        });
        const eslint = await createEslint(sandbox.path);
        const javascript = await eslint.lintFiles(['client.js']);
        expect(
            javascript
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'jsdoc/no-types' || fatal),
        ).toStrictEqual([]);
        const typescriptResults = await eslint.lintFiles(['client.ts']);
        expect(
            typescriptResults
                .flatMap((file) => file.messages)
                .filter(({ ruleId }) => ruleId === 'jsdoc/no-types')
                .map(({ line }) => ({ line })),
        ).toStrictEqual(level === 'all' ? [{ line: 3 }, { line: 4 }] : []);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s requires valid JavaScript type documentation and keeps TypeScript type tags disabled',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        await createFileTree(sandbox.path, { ...JSDOC_PROJECT, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const settings = {
            'missing.js': Object.fromEntries(JSDOC_RULES.map((name) => [name, [2]])),
            'typed.ts': Object.fromEntries(JSDOC_RULES.map((name) => [name, [0]])),
        };
        async function lintReport() {
            const configurations: Record<string, unknown> = {};
            for (const file of ['missing.js', 'typed.ts']) {
                const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile(file));
                configurations[file] = Object.fromEntries(JSDOC_RULES.map((name) => [name, config.rules[name]]));
            }
            const results = await eslint.lintFiles([
                'missing.js',
                'malformed.js',
                'capitalized.js',
                'undefined.js',
                'typed.ts',
            ]);
            return JSON.stringify({
                configurations,
                files: results.map(({ filePath, messages }) => ({
                    file: basename(filePath),
                    findings: messages
                        .filter(({ ruleId, fatal }) => (ruleId !== null && JSDOC_RULES.includes(ruleId)) || fatal)
                        .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
                })),
            });
        }
        const linted = await lintReport();
        expect(linted).toBe(JSON.stringify({ configurations: settings, files: JSDOC_FINDINGS }));
        const failed = await runTestCommand(JSDOC_COMPILER_ARGV, { cwd: sandbox.path });
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stderr).toBe('');
        expect(failed.stdout.replaceAll('\r\n', '\n')).toBe(
            "malformed.js(3,19): error TS1005: ']' expected.\nmissing.js(6,25): error TS7006: Parameter 'value' implicitly has an 'any' type.\nundefined.js(3,12): error TS2304: Cannot find name 'MissingType'.\n",
        );
        for (const { file } of JSDOC_FINDINGS.filter((entry) => entry.file.endsWith('.js')))
            await Bun.write(join(sandbox.path, file), JSDOC_CORRECTION);
        const corrected = await lintReport();
        expect(corrected).toBe(
            JSON.stringify({
                configurations: settings,
                files: JSDOC_FINDINGS.map(({ file }) => ({ file, findings: [] })),
            }),
        );
        const compiled = await runTestCommand(JSDOC_COMPILER_ARGV, { cwd: sandbox.path });
        expect(compiled.code, compiled.stdout + compiled.stderr).toBe(0);
        expect(compiled.stdout + compiled.stderr).toBe('');
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const file of ['package.json', 'jsconfig.json', 'tsconfig.json', 'typed.ts'] as const)
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(JSDOC_PROJECT[file]);
    },
);
