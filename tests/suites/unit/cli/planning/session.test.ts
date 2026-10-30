import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { NODE_SCRIPT } from '#tests/config/typescript.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { SESSION_FILES } from '#tests/config/planning/session.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { buildConfigFiles } from '#cli/generation/config-files/generate.ts';

test('a copied session generates settings from its replacement inventory and run cache', async () => {
    await using sandbox = await testdir({
        ...SESSION_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { rules: true }),
    });
    const opened = await openSession(sandbox.path);
    const previous = buildConfigFiles(opened);
    await writeFile(join(sandbox.path, 'run'), NODE_SCRIPT);
    const fresh = await openSession(sandbox.path);
    const copied = { ...opened, cache: fresh.cache, repository: fresh.repository, scopes: fresh.scopes };
    const generated = buildConfigFiles(copied);
    expect(generated.files).not.toStrictEqual(previous.files);
    expect(generated.files).toStrictEqual(buildConfigFiles(fresh).files);
});

test('a naming-only run leaves mise tool discovery unused', async () => {
    await using sandbox = await testdir({
        ...SESSION_FILES,
        'gspot.toml': buildSandboxSettings(['bash', 'naming'], { rules: true }),
    });
    await using programs = await testdir();
    const log = join(sandbox.path, 'mise-calls.log');
    const bin = await writeProgramCommand(programs.path, 'mise', 'fakes/tool', '--log-arguments', log);
    using _environment = overrideEnvironment({ PATH: `${bin}${delimiter}${readEnvironmentVariable('PATH') ?? ''}` });
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    const result = await runChecks(session, buildRunOptions({ only: ['naming/identifiers'] }));
    expect(result.report.exitCode).toBe(0);
    expect(await isOnDisk(log)).toBe(false);
});

test('a run uses the cancel signal supplied when its session opens', async () => {
    await using sandbox = await testdir({
        ...SESSION_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { rules: true }),
    });
    const session = await openSession(sandbox.path, { cancelSignal: AbortSignal.abort() });
    using _resources = session.resources;
    const result = await runChecks(session, buildRunOptions({ only: ['naming/identifiers'] }));
    expect(result.report.exitCode).toBe(2);
    expect(result.report.checks).toStrictEqual([]);
});
