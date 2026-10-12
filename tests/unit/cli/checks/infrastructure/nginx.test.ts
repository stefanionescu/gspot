import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { NGINX_CONFIGURATION, NGINX_DIRECTIVE_CASES } from '#tests/config/nginx.ts';
import { testArguments, parseDirectives } from '#cli/checks/infrastructure/nginx.ts';

test('testArguments mounts the file, a certificate and a key where the file opens them, and resolves the names it uses', () => {
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
    'a failed certificate step reports its %s text, removes the scratch files, and does not start Docker',
    async (stream) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['nginx']),
            'nginx.conf': NGINX_CONFIGURATION,
        });
        const session = await openSession(sandbox.path);

        using resources = new DisposableStack();
        resources.use(
            mockPinnedExecutables([
                toolDeclaration(session.manifests.values(), 'openssl'),
                toolDeclaration(session.manifests.values(), 'docker'),
            ]),
        );
        const directories: string[] = [];
        const diagnostic = 'The temporary key could not be written.';
        using spawn = spyOn(processes, 'run').mockImplementation((_command, options) => {
            directories.push(options.cwd);
            return Promise.resolve(
                processResult({
                    code: 1,
                    stdout: stream === 'stdout' ? diagnostic : '',
                    stderr: stream === 'stderr' ? diagnostic : '',
                }),
            );
        });

        expect(await rejection(checkFindings(session.root, 'nginx/config-test'))).toBe(
            `The openssl command could not write the temporary certificate: ${diagnostic}`,
        );
        expect(spawn).toHaveBeenCalledTimes(1);
        for (const directory of directories) {
            expect(directory).not.toBe(sandbox.path);
            expect(await pathExists(directory)).toBe(false);
        }
        expect(await readFile(join(sandbox.path, 'nginx.conf'), 'utf8')).toBe(NGINX_CONFIGURATION);
    },
);

test.each([...NGINX_DIRECTIVE_CASES])('nginx directives keep argument boundaries: $source', ({ source, expected }) => {
    expect(parseDirectives(source).map((parts) => [...parts])).toStrictEqual(expected.map((parts) => [...parts]));
});
