import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { symlink, readFile, writeFile } from 'node:fs/promises';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/typescript.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildRunOptions, CHECK_GENERATION } from '#tests/setup/cli/run.ts';
import { runChecks, runCheckCode, buildCheckSession } from '#cli/engine/run.ts';
import { checkGeneratorOutputs } from '#cli/configurations/generator-outputs.ts';
import { BINARY_OUTPUT_HEX } from '#tests/config/checks/cross-configuration/generator-outputs.ts';

test('a [[command_check]] with outputs reports an output that differs from what its command writes', async () => {
    await using sandbox = await createGitSandbox({});
    const generator = JSON.stringify(
        buildProgramCommand('fakes/tool', '--text', 'export const version = 2;\n', 'generated/api.ts'),
    );
    await createFileTree(sandbox.path, {
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

test('generator output patterns omit links to folders', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['drizzle']),
        'drizzle.config.ts': EMPTY_DEFAULT_SOURCE,
        'generated/regular/output.txt': 'generated\n',
    });
    await symlink('regular', join(sandbox.path, 'generated/linked'), 'dir');
    commitAll(sandbox.path);
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'drizzle/stale-migrations');
    const planned = {
        ...input,
        check: {
            ...input.check,
            command: buildProgramCommand('fakes/tool'),
            generator_outputs: [{ kind: 'pattern' as const, path: 'generated/**' }],
        },
    };
    const result = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        planned,
        { check: checkGeneratorOutputs },
        {},
    );
    expect(result.findings).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'generated/regular/output.txt'), 'utf8')).toBe('generated\n');
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
            message: `Running ${command.join(' ')} changes this generated file; commit what it writes.`,
        },
    ]);
    expect(await readFile(output)).toStrictEqual(changed);
});
