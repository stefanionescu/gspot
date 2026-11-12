import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

const BINARY_OUTPUT_HEX = '00ff8047454e455241544544';

test('a [[command_check]] with outputs reports an output that differs from what its command writes', async () => {
    const generator = JSON.stringify(
        buildProgramCommand('fakes/tool', '--text', 'export const version = 2;\n', 'generated/api.ts'),
    );
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: `[[command_check]]\nid = "project/codegen"\ncommand = ${generator}\npaths = ["schema/**"]\noutputs = ["generated/api.ts"]\nstage = "commit"\n`,
        }),
        'schema/api.json': '{"version":2}\n',
        'generated/api.ts': 'export const version = 1;\n',
    });
    commitAll(sandbox.path);
    const stale = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/codegen'] }));
    expect(
        stale.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([{ file: 'generated/api.ts', rule: 'stale' }]);
    expect(await readFile(join(sandbox.path, 'generated/api.ts'), 'utf8')).toBe('export const version = 1;\n');
    await writeFile(join(sandbox.path, 'generated/api.ts'), 'export const version = 2;\n');
    const fresh = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/codegen'] }));
    expect(fresh.report.failed).toStrictEqual([]);
});

test('an unchanged binary output passes and a changed one reports stale', async () => {
    const command = buildProgramCommand('fakes/tool', '--write-hex', `generated/image.bin=${BINARY_OUTPUT_HEX}`);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: `[[command_check]]\nid = "project/image"\ncommand = ${JSON.stringify(command)}\npaths = ["source.txt"]\noutputs = ["generated/image.bin"]\nstage = "commit"\n`,
        }),
        'source.txt': 'image source\n',
        'generated/image.bin': Buffer.from(BINARY_OUTPUT_HEX, 'hex'),
    });
    commitAll(sandbox.path);
    const fresh = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/image'] }));
    expect(fresh.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual([
        { status: 'passed', findings: [] },
    ]);
    const output = join(sandbox.path, 'generated/image.bin');
    const changed = Buffer.from([0, 255, 129]);
    await writeFile(output, changed);
    const stale = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/image'] }));
    expect(stale.report.checks.map(({ status }) => status)).toStrictEqual(['failed']);
    expect(
        stale.report.checks.flatMap(({ findings }) =>
            findings.map(({ file, line, rule, message }) => ({ file, line, rule, message })),
        ),
    ).toStrictEqual([
        {
            file: 'generated/image.bin',
            line: 1,
            rule: 'stale',
            message: expect.stringContaining(command.join(' ')) as string,
        },
    ]);
});
