import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { compareText } from '#cli/system/text.ts';
import {
    CORRECTED_JSDOC,
    JSDOC_FILES,
    JSDOC_FINDINGS,
    JSDOC_RULES,
    ROOT_PARAMETERS,
} from '#tests/config/configurations/javascript/plugins.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

test.each(['all'] as const)(
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
        const eslint = await buildEslint(sandbox.path);
        expect(await listLintFindings(eslint, sandbox.path, ['client.js'], ['jsdoc/no-types'])).toStrictEqual([]);
        expect(await listLintFindings(eslint, sandbox.path, ['client.ts'], ['jsdoc/no-types'])).toStrictEqual([
            { file: 'client.ts', rule: 'jsdoc/no-types', line: 3 },
            { file: 'client.ts', rule: 'jsdoc/no-types', line: 4 },
        ]);
    },
);

test('JavaScript needs valid JSDoc types, and tsc reads the generated jsconfig', async () => {
    await using sandbox = await testdir({
        ...JSDOC_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['missing.js', 'malformed.js', 'capitalized.js', 'undefined.js', 'typed.ts'];
    expect(await listLintFindings(eslint, sandbox.path, files, JSDOC_RULES)).toStrictEqual(
        JSDOC_FINDINGS.flatMap(({ file, findings }) =>
            findings.map(({ ruleId, line }) => ({ file, rule: ruleId, line })),
        ).toSorted(
            (left, right) =>
                compareText(left.file, right.file) || left.line - right.line || compareText(left.rule, right.rule),
        ),
    );
    const tscArguments = [
        'node',
        'node_modules/typescript/lib/tsc.js',
        '--project',
        getManifestTarget('javascript', 'jsconfig.json'),
        '--pretty',
        'false',
    ];
    const failed = await runCommand(tscArguments, { cwd: sandbox.path });
    const output = failed.stdout + failed.stderr;
    expect(
        output
            .split(/\r?\n/u)
            .filter((line) => line.indexOf('(') > 0)
            .map((line) => line.slice(0, line.indexOf('(')))
            .toSorted(compareText),
    ).toStrictEqual(['malformed.js', 'missing.js', 'undefined.js']);
    for (const { file } of JSDOC_FINDINGS) {
        if (!file.endsWith('.js')) continue;
        await writeFile(join(sandbox.path, file), CORRECTED_JSDOC);
    }
    const compiled = await runCommand(tscArguments, { cwd: sandbox.path });
    expect(compiled.code, compiled.stdout + compiled.stderr).toBe(0);
});

test('a doc comment leaves out the parameters that say enough, and a @param line names a parameter', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["*.ts"]}\n',
        'measure.ts': [
            '/**\nCount the characters of the input text.\n*/',
            'export function measure(value: string): number {\n    return value.length;\n}\n',
            '/**\nCount the words of the input text.\n\n@param text the input, split at each space.\n*/',
            "export function count(value: string): number {\n    return value.split(' ').length;\n}\n",
            '/**\nWait for the host.\n\n@param timeout the limit, in seconds.\n*/',
            'export function wait(host: string, timeout: number): string {\n    return `${host}:${timeout}`;\n}\n',
            '/**\nFetch a page.\n\n@param options what to fetch.\n@param options.timeout the limit, in seconds.\n*/',
            'export function fetchPage({ url, timeout }: { url: string; timeout: number }): string {\n    return `${url}:${timeout}`;\n}\n',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['jsdoc/require-param', 'jsdoc/require-param-description', 'jsdoc/check-param-names'];
    expect(await listLintFindings(eslint, sandbox.path, ['measure.ts'], rules)).toStrictEqual([
        { file: 'measure.ts', rule: 'jsdoc/check-param-names', line: 11 },
    ]);
});

test('jsdoc/match-name reports the root0 placeholder and keeps a parameter named root', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': ROOT_PARAMETERS,
    });

    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['jsdoc/match-name'])).toStrictEqual([
        { file: 'source.js', rule: 'jsdoc/match-name', line: 11 },
    ]);
});
