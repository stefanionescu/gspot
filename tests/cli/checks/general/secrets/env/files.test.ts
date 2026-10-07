import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { git, commitAll } from '#tests/harness/git.ts';
import { openSession } from '#cli/commands/session.ts';
import { envFiles } from '#cli/checks/general/secrets.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { STAGED_CASES } from '#tests/config/cli/checks/general/secrets/env/files.ts';

test('tracked-file checks distinguish environment files from templates in nested folders', async () => {
    await using directory = await testdir();
    const privateFiles = ['.env', '.env.local', 'nested/.dev.vars', 'nested/.dev.vars.production'];
    const templates = ['.env.example', '.env.template', 'nested/.env.sample', 'nested/.dev.vars.example'];
    await createFileTree(
        directory.path,
        Object.fromEntries([...privateFiles, ...templates].map((path) => [path, 'EXAMPLE=value\n'])),
    );
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-f', '.']).code).toBe(0);
    await Bun.write(join(directory.path, 'gspot.toml'), buildPolicy(['secrets'], { level: 'all' }));
    const input = buildEngineInput(await openSession(directory.path), 'secrets/env-files', { paths: [] });
    expect(envFiles(input).map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        privateFiles.map((file) => ({ file, rule: 'tracked-env' })),
    );
});

test.each([...STAGED_CASES])('staged environment policy respects a check that is $name', async (entry) => {
    await using sandbox = await testdir();
    const policy = buildPolicy([...entry.configurations], {
        tables: `[[check]]
name = "project/source"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "commit"
${entry.ignore}`,
    });
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original\n' });
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, {
        '.env': 'PUBLIC_EXAMPLE=value\n',
        '.env.example': 'PUBLIC_EXAMPLE=example\n',
        'source.txt': 'changed\n',
    });
    expect(git(sandbox.path, ['add', '-f', '.env', '.env.example', 'source.txt']).code).toBe(0);
    const result = await runGspot(sandbox.path, ['check', '--staged', '--only', entry.check, ...entry.flags, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(entry.code);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks).toMatchObject([
        {
            check: entry.check,
            status: entry.status,
            findings: entry.findings,
        },
    ]);
    expect(await Bun.file(join(sandbox.path, '.env')).text()).toBe('PUBLIC_EXAMPLE=value\n');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
});
