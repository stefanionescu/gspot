import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { processResult } from '#tests/setup/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { prepareLicenseSandbox } from '#tests/setup/licenses.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { virtualEnvironmentExecutable } from '#cli/system/executables.ts';
import { LICENSE_SETTINGS, ALLOWED_PACKAGE_CASES, ALLOWED_PACKAGE_SCOPE_CASES } from '#tests/config/licenses.ts';

test.each([...ALLOWED_PACKAGE_SCOPE_CASES])('allowed packages: $name', async (scenario) => {
    const { scopes, reports, findings } = scenario;
    await using sandbox = await testdir();
    await prepareLicenseSandbox(sandbox.path, scenario);

    const scanned: string[] = [];
    using output = spyOn(processes, 'run').mockImplementation((command) => {
        const interpreter = command.at(-1)!;
        const [scope, identity] = Object.entries(reports).find(
            ([entry]) => interpreter === virtualEnvironmentExecutable(join(sandbox.path, entry, '.venv'), 'python'),
        )!;
        scanned.push(scope);
        const [name, version] = identity.split('@');
        return Promise.resolve(
            processResult({
                stdout: JSON.stringify([
                    {
                        Name: name,
                        Version: version,
                        License: 'MIT',
                    },
                ]),
            }),
        );
    });
    expect(await checkFindings(sandbox.path, 'licenses/allowed')).toStrictEqual(
        findings.map(({ file, rule, diagnostic }) => containing({ file, rule, message: textContaining(diagnostic) })),
    );
    const expected = scopes
        .filter((scope) => scope !== ('ignore' in scenario ? scenario.ignore : undefined))
        .toSorted((a, b) => a.localeCompare(b));
    expect(scanned.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(expected);
    expect(output).toHaveBeenCalledTimes(expected.length);
});

test.each([...ALLOWED_PACKAGE_CASES])('an allowed package: $name', async (sample) => {
    const { license, package: name, findings } = sample;
    const installed = 'installed' in sample ? sample.installed : 'strict';
    await using sandbox = await testdir();
    await prepareLicenseSandbox(
        sandbox.path,
        `${LICENSE_SETTINGS}[[licenses.allowed_package]]\nname = "${name.slice(0, name.lastIndexOf('@'))}"\nversion = "${name.slice(name.lastIndexOf('@') + 1)}"\nreason = "Reviewed the published GPL license."\n`,
    );

    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'run').mockResolvedValue(
            processResult({ stdout: JSON.stringify([{ Name: installed, Version: '1.0.0', License: license }]) }),
        ),
    );
    expect(await checkFindings(sandbox.path, 'licenses/allowed')).toStrictEqual(
        findings.map(({ rule, diagnostic }) =>
            containing({
                file: rule === 'unused-entry' ? 'gspot.toml' : 'pyproject.toml',
                line: 1,
                rule,
                message: textContaining(diagnostic),
            }),
        ),
    );
});
