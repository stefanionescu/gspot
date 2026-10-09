// Sandbox for the nginx configuration: a proxy target the request chooses.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { CLEAN, FORGED, SERVER } from '#tests/config/tools/configurations/tool/nginx.ts';

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
        commitAll(sandbox.path);
        const command = ['check', '--only', 'nginx/config-test', '--json'];
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
        expect(report.checks).toMatchObject([
            { check: 'nginx/config-test', scope: 'proxy', status: 'passed', fileCount: 3 },
        ]);
        expect(report.checks[0]!.files?.toSorted()).toStrictEqual([
            'proxy/conf.d/server.conf',
            'proxy/nginx.conf',
            'proxy/tls#local.conf',
        ]);
        await Bun.write(join(sandbox.path, 'gspot.toml'), NGINX_POLICY.replaceAll('1.29.3-alpine"', '1.29.3-alpine@"'));
        const unavailable = await spawnGspot(sandbox.path, command);
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        expect((JSON.parse(unavailable.stdout) as RunReport).checks).toMatchObject([
            { check: 'nginx/config-test', status: 'error' },
        ]);
        await Bun.write(join(sandbox.path, 'gspot.toml'), NGINX_POLICY);
        const recovered = await spawnGspot(sandbox.path, command);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'proxy/conf.d/server.conf')).text()).toBe(SERVER);
    },
);

describe('the nginx configuration', () => {
    test.skipIf(!hasToolBuild('gixy'))('gixy finds the forged proxy target and passes after the fix', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'proxy/nginx.conf': CLEAN });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['gixy', 'typos', 'editorconfig-checker']) };
        await initRepository(sandbox.path, buildInitArguments(['nginx']), environment, { level: 'all' });
        const clean = await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        const outcome = await runCheckCase(
            sandbox.path,
            { check: 'nginx/gixy', files: { 'proxy/nginx.conf': FORGED } },
            environment,
        );
        const failed = JSON.parse(outcome.stdout) as RunReport;
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        expect(failed.checks).toMatchObject([{ check: 'nginx/gixy', status: 'failed' }]);
        expect(failed.checks[0]?.findings).toContainEqual(
            containing({ rule: 'ssrf', file: 'proxy/nginx.conf', line: 7 }),
        );
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy', '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'nginx/gixy', status: 'passed', findings: [] },
        ]);
    });
});
