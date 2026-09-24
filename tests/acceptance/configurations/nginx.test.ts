import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
// Planted repository for the nginx configuration: a proxy target the request chooses.
import { reportSchema } from '#cli/output/schema.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'nginx',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const server = (location: string): string =>
    `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n${location}    }\n}\n`;
const CLEAN = server('        location / {\n            return 204;\n        }\n');
const FORGED = server('        location ~ /proxy/(.*) {\n            proxy_pass http://$1;\n        }\n');

const CASES: PlantedCase[] = [{ check: 'nginx/gixy', files: { 'proxy/nginx.conf': FORGED }, expected: 'ssrf' }];

test(
    'nginx follows repository include globs and reports the included source line',
    async () => {
        await using sandbox = await testdir();
        const server =
            'server {\n    listen 443 ssl;\n    include /etc/nginx/tls#local.conf;\n    location / { proxy_pass "http://api:3000"; }\n}\n';
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nconfigurations = ["nginx"]\n[tools.nginx]\nimage = "nginx:1.29.3-alpine@"\n[[scope]]\npath = "proxy"\nconfigurations = []\n[scope.tools.nginx]\nimage = "nginx:1.29.3-alpine"\n',
            'proxy/nginx.conf': 'events {}\nhttp { include "conf.d/*.conf"; }\n',
            'proxy/conf.d/server.conf': server.replace('listen 443 ssl;', 'invalid_directive on;'),
            'proxy/tls#local.conf':
                'ssl_certificate "/etc/nginx/ssl/server  certificate.pem"; ssl_certificate_key "/etc/nginx/ssl/server key.pem";\n# include /outside/ignored.conf;\n',
            'proxy/unrelated.conf': 'include /outside/not-used.conf;\n',
        });
        const command = ['check', '--stage', 'push', '--only', 'nginx/config-test', '--no-cache', '--json'];
        const failed = await run(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(failed.stdout)).checks.flatMap((check) => check.findings)).toMatchObject([
            { file: 'proxy/conf.d/server.conf', line: 2, message: expect.stringContaining('invalid_directive') },
        ]);
        await Bun.write(join(sandbox.path, 'proxy/conf.d/server.conf'), server);
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = reportSchema.parse(JSON.parse(corrected.stdout));
        expect(report.checks).toMatchObject([{ scope: 'proxy', files: 3 }]);
        expect(report.checks[0]!.checkedFiles?.toSorted()).toStrictEqual([
            'proxy/conf.d/server.conf',
            'proxy/nginx.conf',
            'proxy/tls#local.conf',
        ]);
        expect(report.coverage.checked).toBe(3);
        expect(await Bun.file(join(sandbox.path, 'proxy/conf.d/server.conf')).text()).toBe(server);
    },
    PLANTED_TIMEOUT_MS * 3,
);

test.each(['recommended', 'all'])(
    'native nginx at %s distinguishes invalid configuration from an unavailable container and accepts corrections',
    async (level) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "${level}"\nconfigurations = ["nginx"]\n[tools.nginx]\nimage = "nginx:1.29.3-alpine"\n`;
        const configuration = `events {}\nhttp {\n    upstream backend {\n        server api:3000;\n    }\n    server {\n        listen 443 ssl;\n        ssl_certificate "/etc/nginx/ssl/certificate.pem";\n        ssl_certificate_key '/etc/nginx/ssl/key.pem';\n        location / {\n            proxy_pass "http://backend";\n        }\n    }\n}\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'proxy/nginx.conf': configuration.replace('listen 443 ssl;', 'invalid_directive on;'),
        });
        const command = ['check', '--stage', 'push', '--only', 'nginx/config-test', '--no-cache', '--json'];
        const failed = await run(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(failed.stdout)).checks.flatMap((check) => check.findings)).toMatchObject([
            {
                file: 'proxy/nginx.conf',
                line: 7,
                rule: 'nginx-t',
                message: expect.stringContaining('invalid_directive'),
            },
        ]);
        await Bun.write(join(sandbox.path, 'proxy/nginx.conf'), configuration);
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy.replace('1.29.3-alpine', '1.29.3-alpine@'));
        const unavailable = await run(sandbox.path, command);
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        expect(reportSchema.parse(JSON.parse(unavailable.stdout)).checks).toMatchObject([
            { check: 'nginx/config-test', status: 'error' },
        ]);
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
        const recovered = await run(sandbox.path, command);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'proxy/nginx.conf')).text()).toBe(configuration);
    },
    PLANTED_TIMEOUT_MS * 5,
);

describe('the nginx configuration', () => {
    test(
        'gixy finds the forged proxy target, and the container test waits for push',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'proxy/nginx.conf': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['gixy', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const clean = await run(sandbox.path, ['check', '--only', 'nginx/gixy', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                if (process.platform === 'win32') {
                    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                    expect(outcome.stdout).toMatch(/skipped\s+nginx\/gixy\s+\(platform\)/u);
                    continue;
                }
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
                expect(outcome.stdout).toContain('proxy/nginx.conf:');
            }
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const atCommit = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(atCommit.checks.map((check) => check.check)).not.toContain('nginx/config-test');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
