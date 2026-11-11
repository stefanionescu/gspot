import { realpathSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Check } from '#cli/types/manifests.ts';
import { ESLINT_PATH_CASES } from '#tests/config/engine/outputs.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { isLinux } from '#tests/setup/system/platform.ts';

test('grouped output drops line endings and makes absolute paths relative', async () => {
    await using sandbox = await testdir({ 'settings/café.toml': 'a=1\n' });

    const base = getShippedCheck('toml/taplo');
    const check: Check = { ...base, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
    const findings = parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toStrictEqual([
        {
            check: check.id,
            file: 'settings/café.toml',
            line: 1,
            message: 'Incorrect spacing',
            help: check.help,
            fixable: false,
        },
    ]);
    expect(
        parseOutput(check, './src/a.ts:\n  2: Incorrect spacing\n', '', { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([
        { check: check.id, file: 'src/a.ts', line: 2, message: 'Incorrect spacing', help: check.help, fixable: false },
    ]);
});

test('a message that names a file by its resolved absolute path names it relative to the root', async () => {
    await using sandbox = await testdir();
    const check = getShippedCheck('docker/compose');
    const file = `${convertToPosixPath(realpathSync.native(sandbox.path))}/api/compose.yml`;
    const output = `validating ${file}: services.api.bogus false schema\n`;
    expect(parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { message: 'validating api/compose.yml: services.api.bogus false schema' },
    ]);
});

test.skipIf(isLinux)('an absolute path that names the root in another case is still relative to it', async () => {
    await using sandbox = await testdir({ 'example/math.py': 'answer = 1\n' });

    const base = getShippedCheck('toml/taplo');
    const check: Check = { ...base, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path.toUpperCase(), 'example', 'math.py')}:\n  1: Incorrect spacing\n`;
    expect(parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'example/math.py', line: 1 },
    ]);
});

test.each([...ESLINT_PATH_CASES])(
    'ESLint paths are relative to the root, inside it and outside it: %s, %s',
    (root, path, expected) => {
        const check = getShippedCheck('javascript/eslint');
        const stdout = JSON.stringify([
            {
                filePath: path,
                messages: [{ ruleId: null, severity: 2, message: 'Invalid syntax.', line: 1, column: 2 }],
            },
        ]);
        expect(parseOutput(check, stdout, '', { root, cwd: root })).toMatchObject([
            { file: expected, line: 1, column: 2 },
        ]);
    },
);
