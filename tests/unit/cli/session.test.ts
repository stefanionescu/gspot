import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { fakeTool } from '#tests/setup/fakes.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { SESSION_FILES, MISE_SESSION_FILES, MISE_LOOKUP_SCRIPT } from '#tests/data/session.ts';

test('a copied session generates settings from its replacement inventory and read cache', async () => {
    await using sandbox = await testdir(SESSION_FILES);
    const opened = await openSession(sandbox.path);
    const original = getToolFiles(opened);
    await writeFile(join(sandbox.path, 'run'), '#!/usr/bin/env node\nconsole.log(1);\n');
    const fresh = await openSession(sandbox.path);
    const copied = { ...opened, reads: fresh.reads, repository: fresh.repository, scopes: fresh.scopes };
    const generated = getToolFiles(copied);
    expect(generated.files).not.toStrictEqual(original.files);
    expect(generated.files).toStrictEqual(getToolFiles(fresh).files);
});

test('a naming-only run leaves mise tool discovery unused', async () => {
    await using sandbox = await testdir(MISE_SESSION_FILES);
    await using programs = await testdir();
    const bin = await fakeTool(programs.path, 'mise', MISE_LOOKUP_SCRIPT);
    using _environment = overrideEnvironment({ PATH: `${bin}${delimiter}${readEnvironmentVariable('PATH') ?? ''}` });
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    const result = await runChecks(session, buildRunOptions({ only: ['naming/identifiers'] }));
    expect(result.report.exitCode).toBe(0);
    expect(await isOnDisk(join(sandbox.path, 'mise-calls.log'))).toBe(false);
});

test('a run uses the cancel signal supplied when its session opens', async () => {
    await using sandbox = await testdir(SESSION_FILES);
    const session = await openSession(sandbox.path, { cancelSignal: AbortSignal.abort() });
    using _resources = session.resources;
    const result = await runChecks(session, buildRunOptions({ only: ['naming/identifiers'] }));
    expect(result.report.exitCode).toBe(2);
    expect(result.report.checks).toStrictEqual([]);
});
