import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { compareText } from '#cli/system/text/order.ts';
import { listFindingRows, parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { runCheckOnChanges } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { hasLinuxDocker, hasToolBuild } from '#tests/setup/system/platform.ts';

const NGINX_SERVER = `server {
    listen 443 ssl;
    include /etc/nginx/tls#local.conf;
    location / { proxy_pass "http://api:3000"; }
}
`;

const NGINX_SCOPE_TABLES = `[nginx]
image = "nginx:1.29.3-alpine@"
[[scope]]
path = "proxy"

configurations = []
[scope.nginx]
image = "nginx:1.29.3-alpine"
`;

const NGINX_INCLUDE_FILES = {
    'proxy/nginx.conf': 'events {}\nhttp { include "conf.d/*.conf"; }\n',
    'proxy/tls#local.conf': `ssl_certificate "/etc/nginx/ssl/server  certificate.pem"; ssl_certificate_key "/etc/nginx/ssl/server key.pem";
# include /outside/ignored.conf;
`,
    'proxy/unrelated.conf': 'include /outside/not-used.conf;\n',
} as const;

test.skipIf(!hasLinuxDocker())(
    'nginx/syntax follows include globs to the source line and tells invalid configuration from an unavailable image',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['nginx'], { tables: NGINX_SCOPE_TABLES, level: 'all' }),
            ...NGINX_INCLUDE_FILES,
            'proxy/conf.d/server.conf': NGINX_SERVER.replace('listen 443 ssl;', 'invalid_directive on;'),
        });

        commitAll(sandbox.path);
        const command = ['check', '--only', 'nginx/syntax', '--json', '--verbose'];
        const failed = parseCheckReport(await spawnGspot(sandbox.path, command));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks.flatMap((check) => check.findings)).toMatchObject([
            {
                file: 'proxy/conf.d/server.conf',
                line: 2,
                rule: 'syntax',
                message: expect.stringContaining('invalid_directive') as string,
            },
        ]);
        await writeFile(join(sandbox.path, 'proxy/conf.d/server.conf'), NGINX_SERVER);
        const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = corrected.report;
        expect(report.checks).toMatchObject([
            { check: 'nginx/syntax', scope: '', status: 'skipped', fileCount: 0 },
            { check: 'nginx/syntax', scope: 'proxy', status: 'passed', fileCount: 3 },
        ]);
        expect(report.checks[1]!.files?.toSorted(compareText)).toStrictEqual([
            'proxy/conf.d/server.conf',
            'proxy/nginx.conf',
            'proxy/tls#local.conf',
        ]);
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['nginx'], { tables: NGINX_SCOPE_TABLES, level: 'all' }).replaceAll(
                '1.29.3-alpine"',
                '1.29.3-alpine@"',
            ),
        );
        const unavailable = parseCheckReport(await spawnGspot(sandbox.path, command));
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        expect(unavailable.report.checks).toMatchObject([
            { check: 'nginx/syntax', scope: '', status: 'skipped', fileCount: 0 },
            { check: 'nginx/syntax', scope: 'proxy', status: 'error' },
        ]);
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['nginx'], { tables: NGINX_SCOPE_TABLES, level: 'all' }),
        );
        const recovered = await spawnGspot(sandbox.path, command);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
    },
);

test.skipIf(!hasToolBuild('gixy'))(
    'gixy reports a proxy_pass that a request can redirect (ssrf), and passes after the fix',
    async () => {
        await using sandbox = await testdir({
            'proxy/nginx.conf': `events {}
http {
    server_tokens off;
    server {
        listen 8080;
        location / {
            return 204;
        }
    }
}
`,
        });

        commitAll(sandbox.path);
        await initSandbox({ root: sandbox.path, run: spawnGspot }, { configurations: ['nginx'], level: 'all' });
        const result = parseCheckReport(
            await runCheckOnChanges(
                { root: sandbox.path, run: spawnGspot },
                {
                    check: 'nginx/gixy',
                    files: {
                        'proxy/nginx.conf': `events {}
http {
    server_tokens off;
    server {
        listen 8080;
        location ~ /proxy/(.*) {
            proxy_pass http://$1;
        }
    }
}
`,
                    },
                },
            ),
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(listFindingRows(result.report)).toStrictEqual([{ file: 'proxy/nginx.conf', line: 7, rule: 'ssrf' }]);
        const corrected = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy', '--json']));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: 'nginx/gixy', status: 'passed', findings: [] }]);
    },
);
