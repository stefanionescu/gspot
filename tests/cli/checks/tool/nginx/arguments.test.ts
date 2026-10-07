import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { nginxTest, testArguments } from '#cli/checks/tool/nginx.ts';
import { NGINX_CONFIGURATION } from '#tests/config/cli/checks/tool/nginx-arguments.ts';

describe('testArguments', () => {
    test('mounts the file, a certificate and a key where the file opens them, and resolves the names it uses', () => {
        const mounts = {
            configs: [{ source: '/repo/nginx.conf', target: '/etc/nginx/nginx.conf' }],
            certificate: '/work/certificate.pem',
            key: '/work/key.pem',
        };
        expect(testArguments(NGINX_CONFIGURATION, mounts, 'nginx:1.29.3-alpine')).toStrictEqual([
            'run',
            '--rm',
            '--add-host',
            'api:127.0.0.1',
            '--add-host',
            'backend:127.0.0.1',
            '-v',
            '/repo/nginx.conf:/etc/nginx/nginx.conf:ro',
            '-v',
            '/work/certificate.pem:/etc/nginx/ssl/fullchain.pem:ro',
            '-v',
            '/work/key.pem:/etc/nginx/ssl/privkey.pem:ro',
            'nginx:1.29.3-alpine',
            'nginx',
            '-T',
        ]);
    });
});

test('dynamic and local nginx targets stay unresolved and repeated certificate mounts are deduplicated', () => {
    const source =
        'events {} http { server { server localhost; server unix:/tmp/socket; server ${upstream}; proxy_pass $url; unrelated api; ssl_certificate $cert; ssl_certificate_key /etc/nginx/key.pem; ssl_trusted_certificate /etc/nginx/cert.pem; ssl_certificate /etc/nginx/cert.pem; } }';
    expect(
        testArguments(source, { configs: [], key: '/work/key', certificate: '/work/cert' }, 'nginx:fixture'),
    ).toStrictEqual([
        'run',
        '--rm',
        '-v',
        '/work/key:/etc/nginx/key.pem:ro',
        '-v',
        '/work/cert:/etc/nginx/cert.pem:ro',
        'nginx:fixture',
        'nginx',
        '-T',
    ]);
});

test('empty directive input adds no mount or host', () => {
    expect(
        testArguments(
            '# Empty configuration.\n;{};',
            { configs: [], key: '/work/key', certificate: '/work/cert' },
            'nginx:fixture',
        ),
    ).toStrictEqual(['run', '--rm', 'nginx:fixture', 'nginx', '-T']);
});

test.each(['stdout', 'stderr'])(
    'certificate failure retains the diagnostic from %s and removes scratch files without starting Docker',
    async (stream) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['nginx']),
            'nginx.conf': NGINX_CONFIGURATION,
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'nginx/test');
        using resources = new DisposableStack();
        resources.use(
            mockPinnedExecutables([
                toolPin(session.manifests.values(), 'openssl'),
                toolPin(session.manifests.values(), 'docker'),
            ]),
        );
        const directories: string[] = [];
        const diagnostic = 'The temporary key could not be written.';
        using spawn = spyOn(processes, 'run').mockImplementation((_command, options) => {
            directories.push(options.cwd);
            return Promise.resolve({
                code: 1,
                stdout: stream === 'stdout' ? diagnostic : '',
                stderr: stream === 'stderr' ? diagnostic : '',
                missing: false,
                duration: 1,
            });
        });

        expect(await rejection(nginxTest(input))).toBe(
            `The openssl command could not write the temporary certificate: ${diagnostic}`,
        );
        expect(spawn).toHaveBeenCalledTimes(1);
        for (const directory of directories) {
            expect(directory).not.toBe(sandbox.path);
            expect(existsSync(directory)).toBe(false);
        }
        expect(readFileSync(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(NGINX_CONFIGURATION);
    },
);
