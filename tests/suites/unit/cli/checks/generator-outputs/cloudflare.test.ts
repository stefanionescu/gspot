import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { EXECUTABLE_FILE } from '#cli/config/files/modes.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { checkGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { runSandboxCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { runCommand, buildProcessResult } from '#tests/setup/system/processes.ts';
import { CLOUDFLARE_ENV_SOURCE, UNTRACKED_CLOUDFLARE_FINDINGS } from '#tests/config/checks/generator-outputs.ts';

async function fakeWrangler(root: string): Promise<DisposableStack> {
    const pin = getTool(readConfigurations().values(), 'wrangler');
    const path = join(root, 'node_modules', '.bin', pin.name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, '');
    await chmod(path, EXECUTABLE_FILE);
    return fakeToolExecutables([pin]);
}

function fakeWranglerTypes(source: string) {
    return spyOn(processes, 'spawnProcess').mockImplementation(async (_commandArguments, options) => {
        await writeFile(join(options.cwd, 'cloudflare-env.d.ts'), source);
        return buildProcessResult();
    });
}

test('custom Worker type settings reach wrangler types as --env-interface', async () => {
    await using sandbox = await testdir();
    const source = CLOUDFLARE_ENV_SOURCE;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            scopes: [{ path: 'workers/api', configurations: ['cloudflare'] }],
            tables: '[scope.cloudflare]\ntypes_file = "workers/api/cloudflare-env.d.ts"\ntypes_interface = "CloudflareEnv"\n',
        }),
        'workers/api/cloudflare-env.d.ts': source,
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(await fakeWrangler(sandbox.path));
    const run = resources.use(fakeWranglerTypes(source));
    const planned = planSandboxCheck(session, 'cloudflare/stale-types', { scope: 'workers/api' });
    const result = await runCheckCode(
        buildCheckSession(session),
        planned,
        planned.check.generator_outputs === undefined ? CHECK_CODE[planned.check.id] : { check: checkGeneratorOutputs },
    );
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
    const source = CLOUDFLARE_ENV_SOURCE;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['cloudflare']),
        'package.json': JSON.stringify({ private: true, devDependencies: { '@opennextjs/cloudflare': '1.0.0' } }),
        'wrangler.jsonc': '{ "name": "shop" }\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'cloudflare-env.d.ts'), source);
    using resources = new DisposableStack();
    resources.use(await fakeWrangler(sandbox.path));
    const run = resources.use(fakeWranglerTypes(source));
    const untracked = await openSession(sandbox.path);
    const untrackedCheck = planSandboxCheck(untracked, 'cloudflare/stale-types');
    const untrackedResult = await runCheckCode(
        buildCheckSession(untracked),
        untrackedCheck,
        untrackedCheck.check.generator_outputs === undefined
            ? CHECK_CODE[untrackedCheck.check.id]
            : { check: checkGeneratorOutputs },
    );
    expect(untrackedResult.findings).toMatchObject([...UNTRACKED_CLOUDFLARE_FINDINGS]);
    expect(run).not.toHaveBeenCalled();
    commitAll(sandbox.path);
    const tracked = await openSession(sandbox.path);
    const trackedCheck = planSandboxCheck(tracked, 'cloudflare/stale-types');
    const trackedResult = await runCheckCode(
        buildCheckSession(tracked),
        trackedCheck,
        trackedCheck.check.generator_outputs === undefined
            ? CHECK_CODE[trackedCheck.check.id]
            : { check: checkGeneratorOutputs },
    );
    expect(trackedResult.findings).toStrictEqual([]);
    expect(run.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
        ['types', 'cloudflare-env.d.ts', '--env-interface', 'CloudflareEnv'],
    ]);
});

test('the wrangler types of tests/node_modules write a cloudflare-env.d.ts that passes, and a changed binding reports the file', async () => {
    using _environment = overrideEnvironment({ WRANGLER_SEND_METRICS: 'false' });
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['cloudflare'], {
            tables: '[cloudflare]\ntypes_file = "cloudflare-env.d.ts"\n',
        }),
        'package.json': '{"private":true,"type":"module","devDependencies":{"wrangler":"0.0.0-test"}}',
        'wrangler.jsonc':
            '{"name":"offline-types","main":"worker.ts","compatibility_date":"2026-01-01","vars":{"GREETING":"hello"}}',
        'worker.ts': 'export default { fetch() { return new Response("Ready"); } };',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    const generated = await runCommand(
        [
            'node',
            join(sandbox.path, 'node_modules/wrangler/bin/wrangler.js'),
            'types',
            'cloudflare-env.d.ts',
            '--env-interface',
            'Env',
        ],
        { cwd: sandbox.path, env: { WRANGLER_SEND_METRICS: 'false' } },
    );
    expect(generated.code, generated.stdout + generated.stderr).toBe(0);
    expect(await runSandboxCheck(sandbox.path, 'cloudflare/stale-types')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'wrangler.jsonc'),
        '{"name":"offline-types","main":"worker.ts","compatibility_date":"2026-01-01","vars":{"GREETING":"hello","NEW_BINDING":"changed"}}',
    );
    expect(await runSandboxCheck(sandbox.path, 'cloudflare/stale-types')).toStrictEqual([
        {
            check: 'cloudflare/stale-types',
            file: 'cloudflare-env.d.ts',
            line: 1,
            rule: 'stale',
            message: 'Running wrangler types --env-interface Env changes this generated file; commit what it writes.',
            fixable: false,
            help: 'Run `wrangler types` and commit the file.',
        },
    ]);
});
