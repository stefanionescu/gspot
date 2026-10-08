// Sandbox for the nginx configuration: a proxy target the request chooses.
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { git, commitAll } from '#tests/harness/git.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { CLEAN, FORGED, SERVER, NGINX_INIT } from '#tests/config/tools/configurations/tool/nginx.ts';

// The root names an image that cannot exist, so only the scope's own image lets the container test run.
const NGINX_POLICY = buildPolicy(['nginx'], {
    tables: '[tools.nginx]\nimage = "nginx:1.29.3-alpine@"\n[scope."proxy"]\nconfigurations = []\n[scope."proxy".tools.nginx]\nimage = "nginx:1.29.3-alpine"\n',
    level: 'all',
});

test.skipIf(!hasLinuxDocker())(
    'nginx -t follows include globs to the source line and tells invalid configuration from a missing container',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': NGINX_POLICY,
            'proxy/nginx.conf': 'events {}\nhttp { include "conf.d/*.conf"; }\n',
            'proxy/conf.d/server.conf': SERVER.replace('listen 443 ssl;', 'invalid_directive on;'),
            'proxy/tls#local.conf':
                'ssl_certificate "/etc/nginx/ssl/server  certificate.pem"; ssl_certificate_key "/etc/nginx/ssl/server key.pem";\n# include /outside/ignored.conf;\n',
            'proxy/unrelated.conf': 'include /outside/not-used.conf;\n',
        });
        const command = ['check', '--hook', 'pre-push', '--only', 'nginx/test', '--json'];
        const failed = await spawnGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((check) => check.findings)).toMatchObject([
            {
                file: 'proxy/conf.d/server.conf',
                line: 2,
                rule: 'syntax',
                message: textContaining('invalid_directive'),
            },
        ]);
        await Bun.write(join(sandbox.path, 'proxy/conf.d/server.conf'), SERVER);
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = JSON.parse(corrected.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: 'nginx/test', scope: 'proxy', status: 'passed', fileCount: 3 }]);
        expect(report.checks[0]!.files?.toSorted()).toStrictEqual([
            'proxy/conf.d/server.conf',
            'proxy/nginx.conf',
            'proxy/tls#local.conf',
        ]);
        await Bun.write(join(sandbox.path, 'gspot.toml'), NGINX_POLICY.replaceAll('1.29.3-alpine"', '1.29.3-alpine@"'));
        const unavailable = await spawnGspot(sandbox.path, command);
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        expect((JSON.parse(unavailable.stdout) as RunReport).checks).toMatchObject([
            { check: 'nginx/test', status: 'error' },
        ]);
        await Bun.write(join(sandbox.path, 'gspot.toml'), NGINX_POLICY);
        const recovered = await spawnGspot(sandbox.path, command);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'proxy/conf.d/server.conf')).text()).toBe(SERVER);
    },
);

describe('the nginx configuration', () => {
    test('gixy finds the forged proxy target, and the container test waits for push', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'proxy/nginx.conf': CLEAN });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['gixy', 'typos', 'ec']) };
        await initRepository(sandbox.path, NGINX_INIT, environment, { level: 'all' });
        const clean = await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        const outcome = await runCheckCase(
            sandbox.path,
            { check: 'nginx/gixy', files: { 'proxy/nginx.conf': FORGED } },
            environment,
        );
        const failed = JSON.parse(outcome.stdout) as RunReport;
        // Gixy has no Windows build, so the check is skipped there and the run passes.
        const isWindows = process.platform === 'win32';
        const forged = containing({ rule: 'ssrf', file: 'proxy/nginx.conf', line: 7 });
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(isWindows ? 0 : 1);
        expect(failed.checks).toMatchObject([
            isWindows
                ? { check: 'nginx/gixy', status: 'skipped' }
                : { check: 'nginx/gixy', status: 'failed', findings: [forged] },
        ]);
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy', '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'nginx/gixy', status: isWindows ? 'skipped' : 'passed', findings: [] },
        ]);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const command = ['check', '--hook', 'pre-commit', '--only', 'nginx/gixy', 'nginx/test', '--json'];
        const checked = await spawnGspot(sandbox.path, command, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const atCommit = JSON.parse(checked.stdout) as RunReport;
        const ids = atCommit.checks.map((check) => check.check);
        expect(ids).toContain('nginx/gixy');
        expect(ids).not.toContain('nginx/test');
    });
});
