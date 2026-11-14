import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { ROOT_PARAMETERS } from '#tests/config/configurations/javascript/plugins.ts';

test('a JavaScript doc comment needs its types, and a TypeScript one may not repeat them', async () => {
    const typed =
        '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\n';
    const untyped =
        '/**\n * Measure the input.\n * @param value The input text.\n * @returns {number} The input length.\n */\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
        'client.ts': `${typed}export function measure(value: string): number { return value.length; }\n`,
        'client.js': `${untyped}export function measure(value) { return value.length; }\n`,
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['jsdoc/no-types', 'jsdoc/require-param-type'];
    expect(await listLintFindings(eslint, sandbox.path, ['client.js', 'client.ts'], rules)).toStrictEqual([
        { file: 'client.js', rule: 'jsdoc/require-param-type', line: 3 },
        { file: 'client.ts', rule: 'jsdoc/no-types', line: 3 },
        { file: 'client.ts', rule: 'jsdoc/no-types', line: 4 },
    ]);
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
