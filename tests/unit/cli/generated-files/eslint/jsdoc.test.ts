import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, compareFindings, collectLintFindings } from '#tests/setup/tool-files.ts';

import {
    FIXED_JSDOC,
    JSDOC_FILES,
    JSDOC_RULES,
    TSC_ARGUMENTS,
    JSDOC_FINDINGS,
    ROOT_PARAMETERS,
} from '#tests/data/generated-files/eslint/jsdoc.ts';

test.each([...LEVELS])(
    'JSDoc types are allowed in JavaScript and duplicate TypeScript type tags are reported at %s',
    async (level) => {
        await using sandbox = await testdir();
        const description =
            '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\n';
        const typescript = 'export function measure(value: string): number { return value.length; }\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['typescript'], { level: level }),
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
            'client.ts': description + typescript,
            'client.js': description + 'export function measure(value) { return value.length; }\n',
        });
        const eslint = await createEslint(sandbox.path);
        expect(await collectLintFindings(eslint, sandbox.path, ['client.js'], ['jsdoc/no-types'])).toStrictEqual([]);
        expect(await collectLintFindings(eslint, sandbox.path, ['client.ts'], ['jsdoc/no-types'])).toStrictEqual(
            level === 'all'
                ? [
                      { file: 'client.ts', rule: 'jsdoc/no-types', line: 3 },
                      { file: 'client.ts', rule: 'jsdoc/no-types', line: 4 },
                  ]
                : [],
        );
    },
);

test('JavaScript needs valid JSDoc types, and tsc reads the generated jsconfig', async () => {
    const level = 'all';
    await using sandbox = await testdir();
    const settings = buildSettingsText(['typescript'], { level });
    await createFileTree(sandbox.path, { ...JSDOC_FILES, 'gspot.toml': settings });
    const eslint = await createEslint(sandbox.path);
    const expectedConfiguration = {
        'missing.js': Object.fromEntries(JSDOC_RULES.map((name) => [name, [2]])),
        'typed.ts': Object.fromEntries(JSDOC_RULES.map((name) => [name, [0]])),
    };
    async function lintFiles() {
        const configurations: Record<string, unknown> = {};
        for (const file of ['missing.js', 'typed.ts']) {
            const config = (await eslint.calculateConfigForFile(file)) as EslintConfiguration;
            configurations[file] = Object.fromEntries(JSDOC_RULES.map((name) => [name, config.rules[name]]));
        }
        return {
            configurations,
            files: await collectLintFindings(
                eslint,
                sandbox.path,
                ['missing.js', 'malformed.js', 'capitalized.js', 'undefined.js', 'typed.ts'],
                JSDOC_RULES,
            ),
        };
    }
    const linted = await lintFiles();
    expect(linted).toStrictEqual({
        configurations: expectedConfiguration,
        files: JSDOC_FINDINGS.flatMap(({ file, findings }) =>
            findings.map(({ ruleId, line }) => ({ file, rule: ruleId, line })),
        ).toSorted(compareFindings),
    });
    const failed = await runCommand(TSC_ARGUMENTS, { cwd: sandbox.path });
    expect(failed.code, failed.stdout + failed.stderr).toBe(2);
    const output = failed.stdout + failed.stderr;
    expect(
        output
            .split(/\r?\n/u)
            .filter((line) => line.indexOf('(') > 0)
            .map((line) => line.slice(0, line.indexOf('(')))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['malformed.js', 'missing.js', 'undefined.js']);
    for (const { file } of JSDOC_FINDINGS.filter((entry) => entry.file.endsWith('.js')))
        await Bun.write(join(sandbox.path, file), FIXED_JSDOC);
    const corrected = await lintFiles();
    expect(corrected).toStrictEqual({
        configurations: expectedConfiguration,
        files: [],
    });
    const compiled = await runCommand(TSC_ARGUMENTS, { cwd: sandbox.path });
    expect(compiled.code, compiled.stdout + compiled.stderr).toBe(0);
});

test('jsdoc/match-name reports the root0 placeholder and keeps a parameter named root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': ROOT_PARAMETERS,
    });
    const eslint = await createEslint(sandbox.path);
    expect(await collectLintFindings(eslint, sandbox.path, ['source.js'], ['jsdoc/match-name'])).toStrictEqual([
        { file: 'source.js', rule: 'jsdoc/match-name', line: 11 },
    ]);
});
