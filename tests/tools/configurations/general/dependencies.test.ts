// A stale Bun lockfile on an installed repository: the lockfile check fails, and regenerating the lockfile passes.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rm, readFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { prepare } from '#cli/commands/init/public.ts';
import { git, commitAll } from '#tests/harness/git.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { checkInput } from '#cli/execution/contracts.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { writeSetup } from '#cli/commands/init/contracts.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { parseTemplate } from '#cli/policy/document/contracts.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

import {
    CLEAN,
    NATIVE_LOCKFILES,
    DEPENDENCIES_INIT,
    SYNCPACK_TAKEOVERS,
} from '#tests/config/tools/configurations/general/dependencies.ts';

test('the dependencies configuration > an outdated Bun lockfile fails, regenerating it passes, and advisory checks wait for their stage', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': CLEAN });
    commitAll(sandbox.path);
    const environment = { PATH: buildToolsPath(['typos', 'editorconfig-checker']) };
    await initRepository(sandbox.path, DEPENDENCIES_INIT, environment, { level: 'all' });
    await createFileTree(sandbox.path, {
        'package.json': JSON.stringify({
            ...JSON.parse(CLEAN),
            workspaces: ['packages/*'],
            dependencies: { 'local-fixture': 'workspace:*' },
        }),
        'packages/local/package.json': '{"name":"local-fixture","version":"1.0.0","private":true}\n',
    });
    await Bun.write(
        join(sandbox.path, 'bun.lock'),
        '{"lockfileVersion":1,"workspaces":{"":{"name":"example"}},"packages":{}}\n',
    );
    const args = ['check', '--only', 'dependencies/stale-lockfile', '--json'];
    const stale = await spawnGspot(sandbox.path, args, environment);
    expect(stale.code, stale.stdout + stale.stderr).toBe(1);
    expect((JSON.parse(stale.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'dependencies/stale-lockfile',
            status: 'failed',
            findings: [
                containing({
                    file: 'bun.lock',
                    rule: 'stale',
                    line: 1,
                    message: textContaining('refuses this lockfile'),
                }),
            ],
        },
    ]);
    const lockfileResult = await runTestCommand([process.execPath, 'install', '--lockfile-only', '--ignore-scripts'], {
        cwd: sandbox.path,
        env: environment,
    });
    expect(lockfileResult.code, lockfileResult.stdout + lockfileResult.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'bun.lock')).exists()).toBe(true);
    const corrected = await spawnGspot(sandbox.path, args, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'dependencies/stale-lockfile', status: 'passed', findings: [] },
    ]);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const staged = ['check', '--hook', 'pre-commit', '--only'];
    const checks = ['dependencies/package-json', 'dependencies/osv', 'dependencies/syncpack'];
    const checked = await spawnGspot(sandbox.path, [...staged, ...checks, '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const ids = (JSON.parse(checked.stdout) as RunReport).checks.map(({ check }) => check);
    expect(ids).toContain('dependencies/package-json');
    expect(ids).not.toContain('dependencies/osv');
    expect(ids).not.toContain('dependencies/syncpack');
});

test.each([...NATIVE_LOCKFILES])(
    'native $name validates $lockfileName without changing repository inputs',
    async ({ client, lockfileName, manifestPath, manifest, changed, files, arguments: commandArguments }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['dependencies']),
            [manifestPath]: manifest,
            ...files,
        });
        const command = client === 'bun' ? process.execPath : client;
        const installed = await runTestCommand([command, ...commandArguments], { cwd: directory.path });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        await rm(join(directory.path, 'node_modules'), { recursive: true, force: true });
        const lockfile = await readFile(join(directory.path, lockfileName));
        await Bun.write(join(directory.path, manifestPath), changed);
        const session = await openSession(directory.path);
        const [planned] = planRun(session, {
            stage: 'push',
            skips: [],
            only: ['dependencies/stale-lockfile'],
        });
        const input = checkInput(session, planned!);
        expect(await BUILT_IN_CHECKS['dependencies/stale-lockfile'].input(input)).toContainEqual(
            containing({ rule: 'stale' }),
        );
        expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
        expect(await readFile(join(directory.path, manifestPath), 'utf8')).toBe(changed);
        await Bun.write(join(directory.path, manifestPath), manifest);
        expect(await BUILT_IN_CHECKS['dependencies/stale-lockfile'].input(input)).toStrictEqual([]);
        expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
        expect(await pathExists(join(directory.path, 'node_modules'))).toBe(false);
    },
);

test.each(SYNCPACK_TAKEOVERS)(
    'initialization retires native Syncpack configuration $file',
    async ({ file, source }) => {
        await using sandbox = await testdir();
        const rootPackage = '{"name":"root","private":true,"dependencies":{"fixture":"1.0.0"}}\n';
        await createFileTree(sandbox.path, {
            [file]: source,
            'package.json': rootPackage,
            'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"fixture":"2.0.0"}}\n',
            'syncpack.config.cts': 'module.exports = {};\n',
            'syncpack.config.mts': 'export default {};\n',
        });
        commitAll(sandbox.path);
        const before = await runTestCommand(['syncpack', 'lint', '--no-ansi'], { cwd: sandbox.path });
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const options = buildInitOptions(sandbox.path, {
            configurations: ['none'],
            template: parseTemplate('template = "coverage"\nselection = "detect"\nlevel = "all"\n', 'level.toml'),
        });
        const prepared = await prepare(sandbox.path, options);
        expect(prepared.plan.remove).toContainEqual({
            path: file,
            note: 'replaced by the generated syncpack configuration',
        });
        expect(
            prepared.plan.remove.some((entry) => ['syncpack.config.cts', 'syncpack.config.mts'].includes(entry.path)),
        ).toBe(false);
        const initialized = await writeSetup(sandbox.path, options, prepared);
        expect(initialized.exitCode).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).exists()).toBe(false);
        expect(await Bun.file(join(sandbox.path, 'syncpack.config.cts')).text()).toBe('module.exports = {};\n');
        expect(await Bun.file(join(sandbox.path, 'syncpack.config.mts')).text()).toBe('export default {};\n');
        const command = ['syncpack', 'lint', '--config', '.gspot/config/syncpack.json', '--no-ansi'];
        const after = await runTestCommand(command, { cwd: sandbox.path });
        expect(after.code, after.stdout + after.stderr).toBe(1);
        expect(after.stderr).toContain('fixture');
        expect(after.stderr).toContain('SameRangeMismatch');
        await Bun.write(join(sandbox.path, 'packages/app/package.json'), rootPackage.replace('"root"', '"app"'));
        const corrected = await runTestCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
