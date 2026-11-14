import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
    const stale = await runSandboxCheck(sandbox.path, 'project/codegen');
    expect(stale.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'generated/api.ts', rule: 'stale' },
    ]);
    expect(await readFile(join(sandbox.path, 'generated/api.ts'), 'utf8')).toBe('export const version = 1;\n');
    await writeFile(join(sandbox.path, 'generated/api.ts'), 'export const version = 2;\n');
    expect(await runSandboxCheck(sandbox.path, 'project/codegen')).toStrictEqual([]);
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
    expect(await runSandboxCheck(sandbox.path, 'project/image')).toStrictEqual([]);
    const output = join(sandbox.path, 'generated/image.bin');
    const changed = Buffer.from([0, 255, 129]);
    await writeFile(output, changed);
    const stale = await runSandboxCheck(sandbox.path, 'project/image');
    expect(stale.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'generated/image.bin',
            line: 1,
            rule: 'stale',
            message: expect.stringContaining(command.join(' ')) as string,
        },
    ]);
});
