import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { runReportSchema } from '#cli/schemas/engine.ts';
import { compareText } from '#cli/system/text.ts';
import { settingsEditOutputSchema } from '#tests/schemas/setup.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

function readKeys(stdout: string): string[] {
    return Object.keys(JSON.parse(stdout) as object).toSorted(compareText);
}

test.each([
    { first: ['add', 'bash'], second: ['add', 'bash'] },
    { first: ['set', 'limits.max_function_lines', '30'], second: ['set', 'limits.max_function_lines', '30'] },
])('$first.0 prints the same keys after a change and after no change', async ({ first, second }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { tables: '[limits]\nmax_function_lines = 20\n' }),
        'README.md': '# Example\n',
    });
    const changed = await runGspot(sandbox.path, [...first, '--json']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    expect(settingsEditOutputSchema.parse(JSON.parse(changed.stdout)).changed).toBe(true);
    const unchanged = await runGspot(sandbox.path, [...second, '--json']);
    expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
    expect(settingsEditOutputSchema.parse(JSON.parse(unchanged.stdout))).toMatchObject({
        changed: false,
        written: [],
        updated: [],
        deleted: [],
        unchanged: [],
    });
});

test('check --staged prints the same keys with nothing staged, with a staged file, and in a plain run', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'README.md': '# Example\n',
    });
    commitAll(sandbox.path);
    const empty = await runGspot(sandbox.path, ['check', '--staged', '--only', 'gspot/generated-files', '--json']);
    expect(runReportSchema.parse(JSON.parse(empty.stdout))).toMatchObject({ comparison: null, fixes: null });
    await writeFile(join(sandbox.path, 'README.md'), '# Changed\n');
    runGitStep(sandbox.path, ['add', 'README.md']);
    const staged = await runGspot(sandbox.path, ['check', '--staged', '--only', 'gspot/generated-files', '--json']);
    expect(runReportSchema.parse(JSON.parse(staged.stdout)).comparison?.content).toBe('index');
    const working = await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']);
    expect(readKeys(working.stdout)).toStrictEqual(readKeys(empty.stdout));
});

test.each([
    { first: ['explain', 'bash/shellcheck'], second: ['explain', 'sandbox/own'] },
    { first: ['explain', 'limits.max_file_lines'], second: ['explain', 'format.quotes'] },
    { first: ['explain', './README.md'], second: ['explain', './image.png'] },
    { first: ['explain', 'yaml/syntax', 'documents'], second: ['explain', 'bash/shellcheck', 'SC2086'] },
])('$first and $second print the same keys', async ({ first, second }) => {
    const tables = stringify({
        command_check: [buildReportingCheck({ id: 'sandbox/own', paths: ['*'], stage: 'commit' })],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'yaml'], { tables }),
        'README.md': '# Example\n',
        'image.png': '\0binary\n',
    });
    const left = await runGspot(sandbox.path, [...first, '--json']);
    expect(left.code, left.stdout + left.stderr).toBe(0);
    const right = await runGspot(sandbox.path, [...second, '--json']);
    expect(right.code, right.stdout + right.stderr).toBe(0);
    expect(readKeys(left.stdout)).toStrictEqual(readKeys(right.stdout));
});
