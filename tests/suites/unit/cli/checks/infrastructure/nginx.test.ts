import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakePinnedExecutables } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { NGINX_MOUNT_CASES, NGINX_UPSTREAM_CONF } from '#tests/config/checks/infrastructure/nginx.ts';

test.each([...NGINX_MOUNT_CASES])(
    'nginx/syntax mounts the nginx.conf and its certificates and maps upstream hosts: $name',
    async ({ source, hosts, certificates }) => {
        await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['nginx']), 'nginx.conf': source });
        const session = await openSession(sandbox.path);
        using _pins = fakePinnedExecutables([
            getTool(session.configurations.values(), 'openssl'),
            getTool(session.configurations.values(), 'docker'),
        ]);
        using run = spyOn(processes, 'spawnProcess').mockImplementation(async (command) => {
            if (!command.includes('--rm')) return buildProcessResult();
            expect(command.filter((_, index) => command[index - 1] === '--add-host')).toStrictEqual([...hosts]);
            const volumes = command.filter((_, index) => command[index - 1] === '-v');
            const configuration = volumes.find((volume) => volume.endsWith(':/etc/nginx/nginx.conf:ro'))!;
            expect(await readFile(configuration.slice(0, -':/etc/nginx/nginx.conf:ro'.length), 'utf8')).toBe(source);
            expect(volumes.map((volume) => volume.split(':').slice(-2).join(':'))).toStrictEqual([
                '/etc/nginx/nginx.conf:ro',
                ...certificates.map((target) => `${target}:ro`),
            ]);
            expect(command.slice(-2)).toStrictEqual(['nginx', '-T']);
            return buildProcessResult({ stdout: '# configuration file /etc/nginx/nginx.conf:\n' });
        });
        expect(await runSandboxCheck(sandbox.path, 'nginx/syntax')).toStrictEqual([]);
        expect(run).toHaveBeenCalledTimes(2);
        expect(await readFile(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(source);
    },
);

test.each(['stdout', 'stderr'])(
    'a failed certificate step reports its %s text, removes the scratch files, and does not start Docker',
    async (stream) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['nginx']),
            'nginx.conf': NGINX_UPSTREAM_CONF,
        });

        const session = await openSession(sandbox.path);

        using resources = new DisposableStack();
        resources.use(
            fakePinnedExecutables([
                getTool(session.configurations.values(), 'openssl'),
                getTool(session.configurations.values(), 'docker'),
            ]),
        );
        const folders: string[] = [];
        const message = 'The temporary key could not be written.';
        using spawn = spyOn(processes, 'spawnProcess').mockImplementation((_command, options) => {
            folders.push(options.cwd);
            return Promise.resolve(
                buildProcessResult({
                    code: 1,
                    stdout: stream === 'stdout' ? message : '',
                    stderr: stream === 'stderr' ? message : '',
                }),
            );
        });

        expect(await captureRejection(runSandboxCheck(session.root, 'nginx/syntax'))).toBe(
            `The openssl command could not write the temporary certificate: ${message}`,
        );
        expect(spawn).toHaveBeenCalledTimes(1);
        for (const folder of folders) {
            expect(folder).not.toBe(sandbox.path);
            expect(await isOnDisk(folder)).toBe(false);
        }
        expect(await readFile(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(NGINX_UPSTREAM_CONF);
    },
);
