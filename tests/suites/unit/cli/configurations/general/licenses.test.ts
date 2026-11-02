import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { realpath } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getBuiltInCheck, planSandboxCheck, openFakeToolSession } from '#tests/setup/cli/checks.ts';

import {
    GPL_PACKAGE,
    MIT_PACKAGE,
    LICENSE_TABLES,
    ALLOWED_PACKAGE_CASES,
} from '#tests/config/configurations/licenses.ts';

async function runLicenseCheck(
    root: string,
    packages: readonly (Record<'name' | 'version' | 'ecosystem', string> & { licenses: readonly string[] })[],
) {
    using resources = new DisposableStack();
    const stdout = JSON.stringify({
        results: [
            {
                source: { path: join(await realpath(root), 'package-lock.json'), type: 'lockfile' },
                packages: packages.map(({ name, version, ecosystem, licenses }) => ({
                    package: { name, version, ecosystem },
                    license_violations: licenses,
                })),
            },
        ],
    });
    const session = await openFakeToolSession(root, ['osv-scanner'], resources);
    const spawn = resources.use(fakeCommands().mockResolvedValue(buildProcessResult({ code: 1, stdout })));
    const findings = await getBuiltInCheck('licenses/allowed')(session, planSandboxCheck(session, 'licenses/allowed'));
    return { findings, command: spawn.mock.calls[0]?.[0] ?? [] };
}

test('licenses/allowed reports a disallowed license of a locked package, on its lockfile', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: LICENSE_TABLES }),
        'package-lock.json': '{}\n',
    });
    const { findings } = await runLicenseCheck(sandbox.path, [MIT_PACKAGE, GPL_PACKAGE]);
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'package-lock.json',
            line: 1,
            rule: 'disallowed-license',
            message: 'strict@1.0.0 uses GPL-3.0-only, which is not allowed.',
        },
    ]);
});

test('licenses/allowed sends the allowed list and leaves gspot and nested scopes out', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: LICENSE_TABLES, scopes: [{ path: 'app' }] }),
        'package-lock.json': '{}\n',
        'app/package-lock.json': '{}\n',
    });
    const { command } = await runLicenseCheck(sandbox.path, [MIT_PACKAGE]);
    expect(command).toContain('--licenses=MIT,Apache-2.0');
    expect(command.filter((_argument, index) => command[index - 1] === '--experimental-exclude')).toStrictEqual([
        GSPOT_FOLDER,
        'app',
    ]);
});

test.each([...ALLOWED_PACKAGE_CASES])(
    'an allowed_package record $name',
    async ({ record, lockedName, ecosystem, findings }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['licenses'], {
                tables: `${LICENSE_TABLES}[[licenses.allowed_package]]\n${record}reason = "Reviewed by legal."\n`,
            }),
            'package-lock.json': '{}\n',
        });
        const { findings: reported } = await runLicenseCheck(sandbox.path, [
            { ...GPL_PACKAGE, name: lockedName, ecosystem },
        ]);
        expect(reported.map(({ rule }) => rule)).toStrictEqual([...findings]);
    },
);

test('osv-scanner findings about vulnerabilities alone pass the license check', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: LICENSE_TABLES }),
        'package-lock.json': '{}\n',
    });
    const { findings } = await runLicenseCheck(sandbox.path, [MIT_PACKAGE]);
    expect(findings).toStrictEqual([]);
});

test.each([
    { name: 'no locked package', code: 0, stdout: '{"results":[]}', status: 'missing' },
    { name: 'a scanner failure', code: 127, stdout: '', status: 'error' },
])('licenses/allowed stops on $name', async ({ code, stdout, status }) => {
    using resources = new DisposableStack();
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: LICENSE_TABLES }),
        'package-lock.json': '{}\n',
    });
    const session = await openFakeToolSession(sandbox.path, ['osv-scanner'], resources);
    resources.use(fakeCommands().mockResolvedValue(buildProcessResult({ code, stdout })));
    const { report } = await runChecks(session, buildRunOptions({ only: ['licenses/allowed'], stage: 'push' }));
    expect(report.checks).toMatchObject([{ check: 'licenses/allowed', status }]);
});

test('the check skips with a note while licenses.allowed is empty', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses']),
        'package-lock.json': '{}\n',
    });
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['licenses/allowed'], stage: 'push' }),
    );
    expect(report.checks).toMatchObject([
        { check: 'licenses/allowed', status: 'skipped', note: 'needs the setting licenses.allowed' },
    ]);
});
