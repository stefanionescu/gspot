import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';

test('the fix of an indented documentation comment leaves no line of spaces', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'reader.js': [
            'export const reader = {',
            '    /**',
            '     * Read the stored value.',
            '     *',
            '     * @returns the stored value.',
            '     */',
            '    read: () => 1,',
            '};',
            '',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path, { fix: true });
    const [result] = await eslint.lintFiles(['reader.js']);
    expect(result?.output?.split('\n').slice(1, 6)).toStrictEqual([
        '    /**',
        '    Read the stored value.',
        '',
        '    @returns the stored value.',
        '    */',
    ]);
});

test('the boolean name fix renames a plain name and leaves a name that starts with another prefix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'flags.js': [
            'export function countFlags(value) {',
            '    const wasReady = value === 1;',
            '    const changed = value === 2;',
            '    return Number(wasReady) + Number(changed);',
            '}',
            '',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path, { fix: true });
    const [result] = await eslint.lintFiles(['flags.js']);
    expect(result?.output?.split('\n').slice(1, 4)).toStrictEqual([
        '    const wasReady = value === 1;',
        '    const isChanged = value === 2;',
        '    return Number(wasReady) + Number(isChanged);',
    ]);
    expect(
        result?.messages
            .filter(({ ruleId }) => ruleId === 'unicorn/consistent-boolean-name')
            .map(({ line, fix }) => ({ line, fix })),
    ).toStrictEqual([{ line: 2, fix: undefined }]);
});

test('an upper-case boolean constant keeps its finding without a fix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'flags.js': '',
    });
    const eslint = await buildEslint(sandbox.path, { fix: true });
    const source = 'export const WAS_READY = Math.random() === 1;\n';
    const [result] = await eslint.lintText(source, { filePath: 'flags.js' });
    expect(result?.output).toBeUndefined();
    expect(
        result?.messages
            .filter(({ ruleId }) => ruleId === 'unicorn/consistent-boolean-name')
            .map(({ line, fix }) => ({ line, fix })),
    ).toStrictEqual([{ line: 1, fix: undefined }]);
});
