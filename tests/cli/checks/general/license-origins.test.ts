import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { SCANNERS, LICENSE_SETTINGS } from '#tests/config/cli/checks/general/licenses.ts';
import type { ExceptionMembership } from '#tests/types/cli/checks/general/license-origins.ts';
import { EXCEPTION_ENTRY, EXCEPTION_MEMBERSHIP } from '#tests/config/cli/checks/general/license-origins.ts';

/** Generate each real selected project before substituting its native scanner report. */
async function prepareInventories(
    root: string,
    { origin, scopes, reports, ignore }: ExceptionMembership,
): Promise<void> {
    const scanner = process.platform === 'win32' ? SCANNERS.windows : SCANNERS.posix;
    const version = toolPin(configurationManifests().values(), 'pip-licenses').version!;
    const tables = scopes
        .map((scope) => {
            const exception = scope === origin ? `[[scope.licenses.exceptions]]\n${EXCEPTION_ENTRY}` : '';
            return `[[scope]]\npath = "${scope}"\n${exception}`;
        })
        .join('');
    const rootException = origin === '' ? `[[licenses.exceptions]]\n${EXCEPTION_ENTRY}` : '';
    const files = Object.fromEntries(
        Object.keys(reports).flatMap((scope) => [
            [join(scope, 'pyproject.toml'), '[project]\nname = "fixture"\nversion = "0.0.0"\n'],
            [join(scope, '.venv/installed'), 'installed'],
        ]),
    );
    const ignored =
        ignore === undefined
            ? ''
            : `[[ignore]]\ncheck = "licenses/packages"\npaths = ["${ignore}/**"]\nreason = "Scope is intentionally outside this license run."\n`;
    await createFileTree(root, {
        ...files,
        'gspot.toml': buildPolicy(['licenses'], { tables: LICENSE_SETTINGS + rootException + tables + ignored }),
        'uv.lock': '[[package]]\nname = "Absent_Package"\nversion = "2.0.0"\n',
        '.gspot/probe/pyproject.toml': '[project]\nname = "tooling"\nversion = "0.0.0"\n',
        '.gspot/probe/.venv/installed': 'Absent_Package@2.0.0',
        [scanner.path]: scanner.body.replace('VERSION', version),
    });
    chmodSync(join(root, scanner.path), 0o755);
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

test.each(EXCEPTION_MEMBERSHIP)('license inventory preserves $name', async (scenario) => {
    const { origin, scopes, reports, stale, ignore, licenses, disallowed } = scenario;
    await using sandbox = await testdir();
    await prepareInventories(sandbox.path, scenario);
    const input = buildCheckInput(await openSession(sandbox.path), 'licenses/packages');
    const scanned: string[] = [];
    using output = spyOn(processes, 'run').mockImplementation((command) => {
        const interpreter = command.at(-1)!;
        const [scope, identity] = Object.entries(reports).find(
            ([entry]) =>
                interpreter ===
                join(sandbox.path, entry, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', 'python'),
        )!;
        scanned.push(scope);
        const [name, version] = identity.split('@');
        return Promise.resolve({
            code: 0,
            missing: false,
            duration: 1,
            stderr: '',
            stdout: JSON.stringify([
                {
                    Name: name,
                    Version: version,
                    License:
                        licenses === undefined
                            ? 'MIT'
                            : (Object.entries(licenses).find(([entry]) => entry === scope)?.[1] ?? 'MIT'),
                },
            ]),
        });
    });
    const expectedFindings: Finding[] = [];
    if (disallowed === undefined) {
        const where = origin === '' ? '' : ` in ${origin}`;
        if (stale)
            expectedFindings.push(
                containing<Finding>({
                    file: 'gspot.toml',
                    rule: 'stale-exception',
                    message: textContaining(
                        `Absent_Package@2.0.0 is absent from the installed project dependencies${where}.`,
                    ),
                }),
            );
    } else
        expectedFindings.push(
            ...disallowed.map((file) =>
                containing<Finding>({
                    file,
                    rule: 'disallowed-license',
                    message: textContaining('the exception no longer holds'),
                }),
            ),
        );
    expect(await licensesPackages(input)).toStrictEqual(expectedFindings);
    const expected = scopes.filter((scope) => scope !== ignore).toSorted((a, b) => a.localeCompare(b));
    expect(scanned.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(expected);
    expect(output).toHaveBeenCalledTimes(expected.length);
});
