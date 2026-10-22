import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, compareFindings, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    JSDOC_FILES,
    JSDOC_RULES,
    TSC_ARGUMENTS,
    JSDOC_FINDINGS,
    CORRECTED_JSDOC,
    ROOT_PARAMETERS,
} from '#tests/data/generation/eslint/jsdoc.ts';

test.each([...LEVELS])(
    'JSDoc types are allowed in JavaScript and duplicate TypeScript type tags are reported at %s',
    async (level) => {
        await using sandbox = await testdir();
        const description =
            '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\n';
        const typescript = 'export function measure(value: string): number { return value.length; }\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['typescript'], { level }),
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
            'client.ts': description + typescript,
            'client.js': description + 'export function measure(value) { return value.length; }\n',
        });
        const eslint = await createEslint(sandbox.path);
        expect(await listLintFindings(eslint, sandbox.path, ['client.js'], ['jsdoc/no-types'])).toStrictEqual([]);
        expect(await listLintFindings(eslint, sandbox.path, ['client.ts'], ['jsdoc/no-types'])).toStrictEqual(
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
    await using sandbox = await testdir({
        ...JSDOC_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
    });
    const eslint = await createEslint(sandbox.path);
    const files = ['missing.js', 'malformed.js', 'capitalized.js', 'undefined.js', 'typed.ts'];
    expect(await listLintFindings(eslint, sandbox.path, files, JSDOC_RULES)).toStrictEqual(
        JSDOC_FINDINGS.flatMap(({ file, findings }) =>
            findings.map(({ ruleId, line }) => ({ file, rule: ruleId, line })),
        ).toSorted(compareFindings),
    );
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
        await writeFile(join(sandbox.path, file), CORRECTED_JSDOC);
    expect(await listLintFindings(eslint, sandbox.path, files, JSDOC_RULES)).toStrictEqual([]);
    const compiled = await runCommand(TSC_ARGUMENTS, { cwd: sandbox.path });
    expect(compiled.code, compiled.stdout + compiled.stderr).toBe(0);
});

test('jsdoc/match-name reports the root0 placeholder and keeps a parameter named root', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': ROOT_PARAMETERS,
    });

    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['jsdoc/match-name'])).toStrictEqual([
        { file: 'source.js', rule: 'jsdoc/match-name', line: 11 },
    ]);
});

test('a missing doc block is reported, and the fixer adds no empty block', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'client.js': '',
    });

    const eslint = await createEslint(sandbox.path, { fix: true });
    const source = 'export function measure(value) {\n    return value.length;\n}\n';
    const [result] = await eslint.lintText(source, { filePath: 'client.js' });
    expect(result?.output ?? source).not.toContain('/**');
    expect(result?.messages.map(({ ruleId }) => ruleId)).toContain('jsdoc/require-jsdoc');
});
