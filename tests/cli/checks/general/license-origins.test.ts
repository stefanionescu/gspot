import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { environmentExecutable } from '#cli/platform/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
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
            const exception =
                scope === origin
                    ? `[scope."${scope}".licenses.exceptions."Absent_Package@2.0.0"]\n${EXCEPTION_ENTRY}`
                    : '';
            return `[scope."${scope}"]\n${exception}`;
        })
        .join('');
    const rootException = origin === '' ? `[licenses.exceptions."Absent_Package@2.0.0"]\n${EXCEPTION_ENTRY}` : '';
    const files = Object.fromEntries(
        Object.keys(reports).flatMap((scope) => [
            [join(scope, 'pyproject.toml'), '[project]\nname = "fixture"\nversion = "0.0.0"\n'],
            [join(scope, '.venv/installed'), 'installed'],
        ]),
    );
    const ignored =
        ignore === undefined
            ? ''
            : `[[ignore]]\ncheck = "licenses/allowed"\npaths = ["${ignore}/**"]\nreason = "Scope is intentionally outside this license run."\n`;
    await createFileTree(root, {
        ...files,
        'gspot.toml': buildPolicy(['licenses'], { tables: LICENSE_SETTINGS + rootException + tables + ignored }),
        'uv.lock': '[[package]]\nname = "Absent_Package"\nversion = "2.0.0"\n',
        '.gspot/probe/pyproject.toml': '[project]\nname = "tooling"\nversion = "0.0.0"\n',
        '.gspot/probe/.venv/installed': 'Absent_Package@2.0.0',
        [scanner.path]: scanner.body.replace('VERSION', version),
    });
    await chmod(join(root, scanner.path), 0o755);
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

test.each(EXCEPTION_MEMBERSHIP)('license inventory preserves $name', async (scenario) => {
    const { origin, scopes, reports, stale, ignore, licenses, disallowed } = scenario;
    await using sandbox = await testdir();
    await prepareInventories(sandbox.path, scenario);
    const input = buildCheckInput(await openSession(sandbox.path), 'licenses/allowed');
    const scanned: string[] = [];
    using output = spyOn(processes, 'run').mockImplementation((command) => {
        const interpreter = command.at(-1)!;
        const [scope, identity] = Object.entries(reports).find(
            ([entry]) => interpreter === environmentExecutable(join(sandbox.path, entry, '.venv'), 'python'),
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
    expect(await BUILT_IN_CHECKS['licenses/allowed'].input(input)).toStrictEqual(expectedFindings);
    const expected = scopes.filter((scope) => scope !== ignore).toSorted((a, b) => a.localeCompare(b));
    expect(scanned.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(expected);
    expect(output).toHaveBeenCalledTimes(expected.length);
});
