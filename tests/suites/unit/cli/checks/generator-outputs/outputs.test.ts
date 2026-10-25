import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { symlink, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runChecks, runCheckCode } from '#cli/commands/check/run.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('a [[command_check]] with outputs reports an output that differs from what its command writes', async () => {
    await using sandbox = await testdir();
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

test('generator output patterns omit directory links', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['drizzle']),
        'drizzle.config.ts': 'export default {};\n',
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
    const result = await runCheckCode(session, planned, findCheckCode(planned.check));
    expect(result.findings).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'generated/regular/output.txt'), 'utf8')).toBe('generated\n');
});
