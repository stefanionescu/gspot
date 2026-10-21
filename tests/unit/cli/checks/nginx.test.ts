import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import * as processes from '#cli/system/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { NGINX_CONFIGURATION, NGINX_DIRECTIVE_CASES } from '#tests/data/checks/nginx.ts';

test.each([
    {
        name: 'certificate paths and upstream hosts',
        source: NGINX_CONFIGURATION,
        hosts: ['api:127.0.0.1', 'backend:127.0.0.1'],
        certificates: ['/etc/nginx/ssl/fullchain.pem', '/etc/nginx/ssl/privkey.pem'],
    },
    {
        name: 'dynamic and local targets',
        source: 'events {} http { server { server localhost; server unix:/tmp/socket; server ${upstream}; proxy_pass $url; unrelated api; ssl_certificate $cert; ssl_certificate_key /etc/nginx/key.pem; ssl_trusted_certificate /etc/nginx/cert.pem; ssl_certificate /etc/nginx/cert.pem; } }',
        hosts: [],
        certificates: ['/etc/nginx/key.pem', '/etc/nginx/cert.pem'],
    },
    { name: 'empty directives', source: '# Empty configuration.\n;{};', hosts: [], certificates: [] },
    ...NGINX_DIRECTIVE_CASES.map(({ source }) => ({
        name: source,
        source,
        hosts: source.includes('https://api:3000') ? ['api:127.0.0.1'] : [],
        certificates: [],
    })),
])('nginx config-test mounts $name', async ({ source, hosts, certificates }) => {
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
        expect(volumes).toHaveLength(1 + certificates.length);
        for (const target of certificates)
            expect(volumes.some((volume) => volume.endsWith(`:${target}:ro`))).toBe(true);
        expect(command.slice(-2)).toStrictEqual(['nginx', '-T']);
        return buildProcessResult({ stdout: '# configuration file /etc/nginx/nginx.conf:\n' });
    });
    expect(await checkFindings(sandbox.path, 'nginx/config-test')).toStrictEqual([]);
    expect(run).toHaveBeenCalledTimes(2);
    expect(await readFile(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(source);
});

test.each(['stdout', 'stderr'])(
    'a failed certificate step reports its %s text, removes the scratch files, and does not start Docker',
    async (stream) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['nginx']),
            'nginx.conf': NGINX_CONFIGURATION,
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

        expect(await captureRejection(checkFindings(session.root, 'nginx/config-test'))).toBe(
            `The openssl command could not write the temporary certificate: ${message}`,
        );
        expect(spawn).toHaveBeenCalledTimes(1);
        for (const folder of folders) {
            expect(folder).not.toBe(sandbox.path);
            expect(await isOnDisk(folder)).toBe(false);
        }
        expect(await readFile(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(NGINX_CONFIGURATION);
    },
);
