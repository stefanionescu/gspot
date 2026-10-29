import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { listStaleLockfiles } from '#cli/installers/projects.ts';
import { buildPythonProjectTable } from '#cli/installers/pypi.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { YARN_CLIENTS } from '#tests/config/installers/projects.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';

test.each([...YARN_CLIENTS])(
    'Yarn $packageManager.version plans an npm tool lockfile without Yarn settings',
    async ({ packageManager }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': JSON.stringify({ private: true, packageManager: `yarn@${packageManager.version}` }),
        });
        const run = processes.spawnProcessBlocking;
        using _npmVersion = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
            command[0] === 'npm' && command[1] === '--version'
                ? buildProcessResult({ stdout: '11.19.0\n' })
                : run(command, options),
        );
        const session = await openSession(sandbox.path);
        const generated = generateFiles(session);
        expect(generated.files.some(({ path }) => path === '.gspot/.yarnrc.yml')).toBe(false);
        const lockfiles = await listStaleLockfiles(session, generated.files);
        expect(
            lockfiles.filter(({ path }) => path !== GSPOT_PATHS.uvLockfile && path !== GSPOT_PATHS.miseLockfile),
        ).toStrictEqual([{ path: '.gspot/package-lock.json', kind: 'missing' }]);
        expect(session.packageManager).toStrictEqual(packageManager);
    },
);

test('tool lockfiles report missing and changed projects and omit current projects', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python']),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const session = await openSession(sandbox.path);
    const generated = generateFiles(session).files;
    const paths = [GSPOT_PATHS.miseLockfile, '.gspot/bun.lock', GSPOT_PATHS.uvLockfile];
    expect(await listStaleLockfiles(session, generated)).toStrictEqual(
        paths.map((path) => ({ path, kind: 'missing' })),
    );
    const lockfiles = buildToolLockfiles(session.toolConfigurations);
    await createFileTree(sandbox.path, lockfiles);
    expect(await listStaleLockfiles(session, generated)).toStrictEqual([]);
    await createFileTree(sandbox.path, Object.fromEntries(paths.map((path) => [path, 'invalid ='])));
    expect(await listStaleLockfiles(session, generated)).toStrictEqual(
        paths.map((path) => ({ path, kind: 'changed' })),
    );
});

function buildToolLockfiles(configurations: Configuration[]): Record<string, string> {
    const dependencies = listToolProjectPins(configurations).npm;
    const python = buildPythonProjectTable(configurations);
    return {
        [GSPOT_PATHS.miseLockfile]: stringify({
            tools: Object.fromEntries(
                listMisePins(configurations).map((pin) => [
                    pin.name,
                    [
                        {
                            version: pin.version,
                            'platforms.linux-x64': {
                                url: 'https://github.com/example/tool/releases/download/v1.0.0/tool.tar.gz',
                                checksum: pin.checksums?.['linux-x64'] ?? `sha256:${'a'.repeat(64)}`,
                            },
                        },
                    ],
                ]),
            ),
        }),
        '.gspot/bun.lock': JSON.stringify({
            workspaces: { '': { devDependencies: dependencies } },
            packages: Object.fromEntries(
                Object.entries(dependencies).map(([name, version]) => [
                    name,
                    [`${name}@${version}`, '', {}, 'sha512-YQ=='],
                ]),
            ),
        }),
        [GSPOT_PATHS.uvLockfile]: stringify({
            version: 1,
            'requires-python': python['requires-python'],
            options: { 'exclude-newer-span': 'P7D' },
            package: [
                {
                    name: python.name,
                    version: python.version,
                    source: { virtual: '.' },
                    metadata: {
                        'requires-dist': python.dependencies.map((pin) => {
                            const [name, version] = pin.split('==');
                            return { name, specifier: `==${version!}` };
                        }),
                    },
                },
            ],
        }),
    };
}
