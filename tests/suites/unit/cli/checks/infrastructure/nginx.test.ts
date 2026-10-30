import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';

import {
    NGINX_MOUNT_CASES,
    NGINX_UPSTREAM_CONF,
    NGINX_FAILURE_CASES,
} from '#tests/config/checks/infrastructure/nginx.ts';

test.each([...NGINX_MOUNT_CASES])(
    'nginx/syntax mounts the nginx.conf and its certificates and maps upstream hosts: $name',
    async ({ source, hosts, certificates }) => {
        await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['nginx']), 'nginx.conf': source });
        const session = await openSession(sandbox.path);
        using _pins = fakeToolExecutables([
            getTool(session.configurationsByName.values(), 'openssl'),
            getTool(session.configurationsByName.values(), 'docker'),
        ]);
        const containers: {
            hosts: string[];
            targets: string[];
            configuration: string;
            tail: string[];
            image: string | undefined;
        }[] = [];
        using run = fakeCommands().mockImplementation(async (command) => {
            const volumes = command.filter((_, index) => command[index - 1] === '-v');
            const configuration = volumes.find((volume) => volume.endsWith(':/etc/nginx/nginx.conf:ro'));
            if (configuration === undefined) return buildProcessResult();
            containers.push({
                hosts: command.filter((_, index) => command[index - 1] === '--add-host'),
                targets: volumes.map((volume) => volume.split(':').slice(-2).join(':')),
                configuration: await readFile(configuration.slice(0, -':/etc/nginx/nginx.conf:ro'.length), 'utf8'),
                tail: command.slice(-2),
                image: command.at(-3),
            });
            return buildProcessResult({ stdout: '# configuration file /etc/nginx/nginx.conf:\n' });
        });
        expect(await runSandboxCheck(sandbox.path, 'nginx/syntax')).toStrictEqual([]);
        expect(run).toHaveBeenCalledTimes(2);
        expect(containers).toStrictEqual([
            {
                hosts: [...hosts],
                targets: ['/etc/nginx/nginx.conf:ro', ...certificates.map((target) => `${target}:ro`)],
                configuration: source,
                tail: ['nginx', '-T'],
                image: expect.stringMatching(/^nginx:[^@]+@sha256:[0-9a-f]{64}$/u) as string,
            },
        ]);
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
        const fakes = fakeToolExecutables([
            getTool(session.configurationsByName.values(), 'openssl'),
            getTool(session.configurationsByName.values(), 'docker'),
        ]);
        resources.use(fakes);
        const folders: string[] = [];
        const message = 'The temporary key could not be written.';
        using _spawn = fakeCommands().mockImplementation((_command, options) => {
            folders.push(options.cwd);
            return Promise.resolve(
                buildProcessResult({
                    code: 1,
                    stdout: stream === 'stdout' ? message : '',
                    stderr: stream === 'stderr' ? message : '',
                }),
            );
        });

        const error = await captureRejection(runSandboxCheck(session.root, 'nginx/syntax'));
        expect(error.message).toBe(`The openssl command could not write the temporary certificate: ${message}`);
        expect(_spawn).toHaveBeenCalledTimes(1);
        for (const folder of folders) {
            expect(folder).not.toBe(sandbox.path);
            expect(await isOnDisk(folder)).toBe(false);
        }
        expect(await readFile(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(NGINX_UPSTREAM_CONF);
    },
);

test.each(NGINX_FAILURE_CASES)('nginx/syntax reports $name', async ({ stderr, status, note, findings }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['nginx']),
        'nginx.conf': 'events {}\nhttp { include /etc/nginx/conf.d/site.conf; }\n',
        'conf.d/site.conf': 'server {}\n',
    });
    const session = await openSession(sandbox.path);
    using _pins = fakeToolExecutables(
        ['openssl', 'docker'].map((name) => getTool(session.configurationsByName.values(), name)),
    );
    using _spawn = fakeCommands().mockImplementation((command) =>
        Promise.resolve(buildProcessResult(command.includes('--rm') ? { code: 1, stderr } : {})),
    );
    const { report } = await runChecks(session, buildRunOptions({ only: ['nginx/syntax'] }));
    expect(
        report.checks.map((check) => ({ status: check.status, note: check.note, findings: check.findings })),
    ).toStrictEqual([{ status, note, findings }]);
});
