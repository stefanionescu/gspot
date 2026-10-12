import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { checkChanges } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { toolsPath, initRepository } from '#tests/setup/install.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { isLinux, hasToolBuild } from '#tests/setup/operating-systems.ts';

import {
    NGINX_SERVER,
    CLEAN_NGINX_CONFIG,
    NGINX_INCLUDE_FILES,
    FORGED_NGINX_CONFIG,
    NGINX_SCOPE_SETTINGS,
} from '#tests/config/nginx.ts';

// The root names an image that cannot exist, so only the scope's own image lets the container test run.
const NGINX_POLICY = settingsText(['nginx'], {
    tables: NGINX_SCOPE_SETTINGS,
    level: 'all',
});

// These Docker checks need the Linux Docker engine.
test.skipIf(!isLinux)(
    'nginx -t follows include globs to the source line and tells invalid configuration from a missing container',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': NGINX_POLICY,
            ...NGINX_INCLUDE_FILES,
            'proxy/conf.d/server.conf': NGINX_SERVER.replace('listen 443 ssl;', 'invalid_directive on;'),
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
        await Bun.write(join(sandbox.path, 'proxy/conf.d/server.conf'), NGINX_SERVER);
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
        expect(await Bun.file(join(sandbox.path, 'proxy/conf.d/server.conf')).text()).toBe(NGINX_SERVER);
    },
);

// The pinned gixy tool has no build for some operating systems.
test.skipIf(!hasToolBuild('gixy'))('gixy finds the forged proxy target and passes after the fix', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'proxy/nginx.conf': CLEAN_NGINX_CONFIG });
    commitAll(sandbox.path);
    const environment = { PATH: toolsPath() };
    await initRepository(sandbox.path, buildInitArguments(['nginx']), environment, { level: 'all' });
    const clean = await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy'], environment);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    const outcome = await checkChanges(
        sandbox.path,
        { check: 'nginx/gixy', files: { 'proxy/nginx.conf': FORGED_NGINX_CONFIG } },
        environment,
    );
    const failed = JSON.parse(outcome.stdout) as RunReport;
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
    expect(failed.checks).toMatchObject([{ check: 'nginx/gixy', status: 'failed' }]);
    expect(failed.checks[0]?.findings).toContainEqual(containing({ rule: 'ssrf', file: 'proxy/nginx.conf', line: 7 }));
    const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'nginx/gixy', status: 'passed', findings: [] },
    ]);
});
