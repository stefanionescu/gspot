import { join, dirname } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { getTable } from '#cli/settings/scopes.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { EXECUTABLE_FILE } from '#cli/config/files/modes.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';
import { UNTRACKED_CLOUDFLARE_FINDINGS } from '#tests/config/checks/generator-outputs.ts';

async function mockWrangler(root: string): Promise<DisposableStack> {
    const pin = getTool(readConfigurations().values(), 'wrangler');
    const path = join(root, 'node_modules', '.bin', pin.name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, '');
    await chmod(path, EXECUTABLE_FILE);
    return fakeToolExecutables([pin]);
}

function spyOnWranglerTypes(source: string) {
    return spyOn(processes, 'spawnProcess').mockImplementation(async (_commandArguments, options) => {
        await writeFile(join(options.cwd, 'cloudflare-env.d.ts'), source);
        return buildProcessResult();
    });
}

test('custom Worker type settings reach wrangler types as --env-interface', async () => {
    await using sandbox = await testdir();
    const source = 'interface CloudflareEnv {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            scopes: [{ path: 'workers/api', configurations: ['cloudflare'] }],
            tables: '[scope.cloudflare]\ntypes_file = "workers/api/cloudflare-env.d.ts"\ntypes_interface = "CloudflareEnv"\n',
        }),
        'workers/api/cloudflare-env.d.ts': source,
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(await mockWrangler(sandbox.path));
    const run = resources.use(spyOnWranglerTypes(source));
    const planned = planSandboxCheck(session, 'cloudflare/stale-types', { scope: 'workers/api' });
    const result = await runCheckCode(buildCheckSession(session), planned, findCheckCode(planned.check));
    expect(result.findings).toStrictEqual([]);
    expect(run.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
        ['types', 'cloudflare-env.d.ts', '--env-interface', 'CloudflareEnv'],
    ]);
    const { cwd } = run.mock.calls[0]![1];
    expect(cwd).not.toBe(join(sandbox.path, 'workers/api'));
    expect(await isOnDisk(cwd)).toBe(false);
    expect(await readFile(join(sandbox.path, 'workers/api/cloudflare-env.d.ts'), 'utf8')).toBe(source);
});

test('an OpenNext project checks cloudflare-env.d.ts against CloudflareEnv, and reports the file until Git tracks it', async () => {
    await using sandbox = await testdir();
    const source = 'interface CloudflareEnv {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['cloudflare']),
        'package.json': JSON.stringify({ private: true, devDependencies: { '@opennextjs/cloudflare': '1.0.0' } }),
        'wrangler.jsonc': '{ "name": "shop" }\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'cloudflare-env.d.ts'), source);
    using resources = new DisposableStack();
    resources.use(await mockWrangler(sandbox.path));
    const run = resources.use(spyOnWranglerTypes(source));
    const untracked = await openSession(sandbox.path);
    expect(getTable(untracked.scopes[0]!.settings, 'cloudflare')).toStrictEqual({
        types_file: 'cloudflare-env.d.ts',
        types_interface: 'CloudflareEnv',
    });
    const untrackedCheck = planSandboxCheck(untracked, 'cloudflare/stale-types');
    const untrackedResult = await runCheckCode(
        buildCheckSession(untracked),
        untrackedCheck,
        findCheckCode(untrackedCheck.check),
    );
    expect(untrackedResult.findings).toMatchObject([...UNTRACKED_CLOUDFLARE_FINDINGS]);
    expect(run).not.toHaveBeenCalled();
    commitAll(sandbox.path);
    const tracked = await openSession(sandbox.path);
    const trackedCheck = planSandboxCheck(tracked, 'cloudflare/stale-types');
    const trackedResult = await runCheckCode(
        buildCheckSession(tracked),
        trackedCheck,
        findCheckCode(trackedCheck.check),
    );
    expect(trackedResult.findings).toStrictEqual([]);
    expect(run.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
        ['types', 'cloudflare-env.d.ts', '--env-interface', 'CloudflareEnv'],
    ]);
});
