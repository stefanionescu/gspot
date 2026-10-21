import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { installSandbox } from '#tests/setup/install.ts';
import { checkChanges } from '#tests/setup/sample-checks.ts';
import { isLinux, hasToolBuild } from '#tests/setup/system.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

import {
    NGINX_SERVER,
    CLEAN_NGINX_CONFIG,
    FORGED_NGINX_CONFIG,
    NGINX_INCLUDE_FILES,
    NGINX_SCOPE_SETTINGS,
} from '#tests/data/checks/nginx.ts';

// These Docker checks need the Linux Docker engine.
test.skipIf(!isLinux)(
    'nginx -t follows include globs to the source line and tells invalid configuration from a missing container',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['nginx'], { tables: NGINX_SCOPE_SETTINGS, level: 'all' }),
            ...NGINX_INCLUDE_FILES,
            'proxy/conf.d/server.conf': NGINX_SERVER.replace('listen 443 ssl;', 'invalid_directive on;'),
        });

        commitAll(sandbox.path);
        const command = ['check', '--only', 'nginx/config-test', '--json'];
        const failed = parseCheckReport(await spawnGspot(sandbox.path, command));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks.flatMap((check) => check.findings)).toMatchObject([
            {
                file: 'proxy/conf.d/server.conf',
                line: 2,
                rule: 'syntax',
                message: matchSubstring('invalid_directive'),
            },
        ]);
        await writeFile(join(sandbox.path, 'proxy/conf.d/server.conf'), NGINX_SERVER);
        const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = corrected.report;
        expect(report.checks).toMatchObject([
            { check: 'nginx/config-test', scope: '', status: 'skipped', fileCount: 0 },
            { check: 'nginx/config-test', scope: 'proxy', status: 'passed', fileCount: 3 },
        ]);
        expect(report.checks[1]!.files?.toSorted()).toStrictEqual([
            'proxy/conf.d/server.conf',
            'proxy/nginx.conf',
            'proxy/tls#local.conf',
        ]);
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['nginx'], { tables: NGINX_SCOPE_SETTINGS, level: 'all' }).replaceAll(
                '1.29.3-alpine"',
                '1.29.3-alpine@"',
            ),
        );
        const unavailable = parseCheckReport(await spawnGspot(sandbox.path, command));
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        expect(unavailable.report.checks).toMatchObject([
            { check: 'nginx/config-test', scope: '', status: 'skipped', fileCount: 0 },
            { check: 'nginx/config-test', scope: 'proxy', status: 'error' },
        ]);
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['nginx'], { tables: NGINX_SCOPE_SETTINGS, level: 'all' }),
        );
        const recovered = await spawnGspot(sandbox.path, command);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'proxy/conf.d/server.conf'), 'utf8')).toBe(NGINX_SERVER);
    },
);

test.skipIf(!hasToolBuild('gixy'))('gixy finds the forged proxy target and passes after the fix', async () => {
    await using sandbox = await testdir({ 'proxy/nginx.conf': CLEAN_NGINX_CONFIG });

    commitAll(sandbox.path);
    const environment = {};
    await installSandbox(
        { root: sandbox.path, environment: environment, run: spawnGspot },
        { configurations: ['nginx'], level: 'all' },
    );
    const clean = await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy'], environment);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    const result = parseCheckReport(
        await checkChanges(
            sandbox.path,
            { check: 'nginx/gixy', files: { 'proxy/nginx.conf': FORGED_NGINX_CONFIG } },
            environment,
        ),
    );
    const failed = result.report;
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(failed.checks).toMatchObject([{ check: 'nginx/gixy', status: 'failed' }]);
    expect(failed.checks[0]?.findings).toContainEqual(matchFields({ rule: 'ssrf', file: 'proxy/nginx.conf', line: 7 }));
    const corrected = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'nginx/gixy', '--json'], environment),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'nginx/gixy', status: 'passed', findings: [] }]);
});
