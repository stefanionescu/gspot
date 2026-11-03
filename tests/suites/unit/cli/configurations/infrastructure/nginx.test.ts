import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { getTool } from '#cli/tools/pins.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';

import {
    NGINX_MOUNT_CASES,
    NGINX_FAILURE_CASES,
    NGINX_UPSTREAM_CONFIG,
} from '#tests/config/configurations/infrastructure.ts';

test.each([...NGINX_MOUNT_CASES])(
    'nginx/syntax mounts the nginx.conf and its certificates and maps upstream hosts: $name',
    async ({ source, hosts, certificates }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['nginx']),
            'nginx.conf': source,
        });
        using _pins = fakeToolExecutables([
            getTool(readConfigurations().values(), 'openssl'),
            getTool(readConfigurations().values(), 'docker'),
        ]);
        const containers: Array<{
            hosts: string[];
            targets: string[];
            configuration: string;
            tail: string[];
            image: string | undefined;
        }> = [];
        using _run = fakeCommands().mockImplementation(async (command) => {
            const mounts = command
                .filter((_, index) => command[index - 1] === '--mount')
                .map(
                    (mount) =>
                        /^type=bind,"source=(?<source>.+)","target=(?<target>.+)",readonly$/u.exec(mount)?.groups,
                );
            const configuration = mounts.find((mount) => mount?.['target'] === '/etc/nginx/nginx.conf');
            if (configuration === undefined) return buildProcessResult();
            containers.push({
                hosts: command.filter((_, index) => command[index - 1] === '--add-host'),
                targets: mounts.map((mount) => mount?.['target'] ?? ''),
                configuration: await readFile(configuration['source'] ?? '', 'utf8'),
                tail: command.slice(-2),
                image: command.at(-3),
            });
            return buildProcessResult({ stdout: '# configuration file /etc/nginx/nginx.conf:\n' });
        });
        expect(await runSandboxCheck(sandbox.path, 'nginx/syntax')).toStrictEqual([]);
        expect(containers).toStrictEqual([
            {
                hosts: [...hosts],
                targets: ['/etc/nginx/nginx.conf', ...certificates],
                configuration: source,
                tail: ['nginx', '-T'],
                image: expect.stringMatching(/^nginx:[^@]+@sha256:[0-9a-f]{64}$/u) as string,
            },
        ]);
        expect(await readFile(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(source);
    },
);

test('a failed certificate step reports its error text, removes the scratch files, and does not start Docker', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['nginx']),
        'nginx.conf': NGINX_UPSTREAM_CONFIG,
    });

    const session = await openSession(sandbox.path);

    using resources = new DisposableStack();
    const fakes = fakeToolExecutables([
        getTool(readConfigurations().values(), 'openssl'),
        getTool(readConfigurations().values(), 'docker'),
    ]);
    resources.use(fakes);
    const folders: string[] = [];
    const message = 'The temporary key could not be written.';
    using _spawn = fakeCommands().mockImplementation((_command, options) => {
        folders.push(options.cwd);
        return Promise.resolve(buildProcessResult({ code: 1, stderr: message }));
    });

    const error = await captureRejection(runSandboxCheck(session.root, 'nginx/syntax'));
    expect(error.message).toBe(`The openssl command failed (exit 1): ${message}`);
    expect(_spawn).toHaveBeenCalledTimes(1);
    for (const folder of folders) {
        expect(folder).not.toBe(sandbox.path);
        expect(existsSync(folder)).toBe(false);
    }
    expect(await readFile(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(NGINX_UPSTREAM_CONFIG);
});

test.each(NGINX_FAILURE_CASES)('nginx/syntax reports $name', async ({ stderr, status, note, findings }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['nginx']),
        'nginx.conf': 'events {}\nhttp { include /etc/nginx/conf.d/site.conf; }\n',
        'conf.d/site.conf': 'server {}\n',
    });
    const session = await openSession(sandbox.path);
    using _pins = fakeToolExecutables(
        ['openssl', 'docker'].map((name) => getTool(readConfigurations().values(), name)),
    );
    using _spawn = fakeCommands().mockImplementation((command) =>
        Promise.resolve(buildProcessResult(command.includes('--rm') ? { code: 1, stderr } : {})),
    );
    const { report } = await runChecks(session, buildRunOptions({ only: ['nginx/syntax'] }));
    expect(
        report.checks.map((check) => ({
            status: check.status,
            note: check.note,
            findings: check.findings.map(({ file, line, rule, message }) => ({ file, line, rule, message })),
        })),
    ).toStrictEqual([{ status, note, findings: [...findings] }]);
});
