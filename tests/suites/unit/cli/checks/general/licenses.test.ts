import { join, relative } from 'node:path';
import { realpath } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { fakeNpmTool, writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { buildVenvBinPath, buildVenvExecutablePath } from '#cli/system/paths.ts';

import {
    LICENSE_TABLES,
    SAMPLE_PYPROJECT,
    SCANNER_FAILURES,
    NPM_LICENSE_REPORT,
    LICENSE_PACKAGE_JSON,
    ALLOWED_PACKAGE_CASES,
    LICENSE_PROJECT_FILES,
    PYTHON_LICENSE_REPORT,
    SCAN_ALLOWED_PACKAGES,
    ALLOWED_PACKAGE_REASON,
    EXPECTED_SCAN_FINDINGS,
    PYTHON_LICENSE_SOURCES,
    LICENSE_DEPENDENCY_FILES,
    LICENSE_TOOL_PROJECT_FILES,
    ALLOWED_PACKAGE_SCOPE_CASES,
} from '#tests/config/checks/general/licenses.ts';

test.each([...ALLOWED_PACKAGE_SCOPE_CASES])(
    'licenses/allowed keeps a root allowed_package record that a project uses: $name',
    async (scenario) => {
        const { scopes, reports, findings } = scenario;
        await using sandbox = await testdir();
        await writeScopeLicenseSandbox(sandbox.path, scenario);

        const scanned: string[] = [];
        using output = spyOn(processes, 'spawnProcess').mockImplementation((command) => {
            const interpreter = command.at(-1)!;
            const [scope, identity] = Object.entries(reports).find(
                ([entry]) => interpreter === buildVenvExecutablePath(join(sandbox.path, entry, '.venv'), 'python'),
            )!;
            scanned.push(scope);
            const [name, version] = identity.split('@');
            return Promise.resolve(
                buildProcessResult({
                    stdout: JSON.stringify([
                        {
                            Name: name,
                            Version: version,
                            'License-Expression': 'MIT',
                        },
                    ]),
                }),
            );
        });
        expect(await runSandboxCheck(sandbox.path, 'licenses/allowed')).toStrictEqual([...findings]);
        const expected = scopes
            .filter((scope) => scope !== ('ignore' in scenario ? scenario.ignore : undefined))
            .toSorted((a, b) => a.localeCompare(b));
        expect(scanned.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(expected);
        expect(output).toHaveBeenCalledTimes(expected.length);
    },
);

test.each([...ALLOWED_PACKAGE_CASES])(
    'licenses/allowed matches an allowed_package record by exact name and version: $name',
    async (sample) => {
        const { license, package: name, findings } = sample;
        const { installed } = sample;
        await using sandbox = await testdir();
        await writeLicenseSandbox(
            sandbox.path,
            `${LICENSE_TABLES}[[licenses.allowed_package]]\nname = "${name.slice(0, name.lastIndexOf('@'))}"\nversion = "${name.slice(name.lastIndexOf('@') + 1)}"\nreason = "Reviewed the published GPL license."\n`,
        );

        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'spawnProcess').mockResolvedValue(
                buildProcessResult({
                    stdout: JSON.stringify([{ Name: installed, Version: '1.0.0', 'License-Expression': license }]),
                }),
            ),
        );
        const found = await runSandboxCheck(sandbox.path, 'licenses/allowed');
        expect(found.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([...findings]);
    },
);
test.each(['', 'apps/example'].flatMap((scope) => LICENSE_DEPENDENCY_FILES.map((row) => ({ scope, ...row }))))(
    'scan: a scan in scope "$scope" stops before any scanner when $dependencyFile dependencies are not installed',
    async ({ scope, dependencyFile, text, installedFolder }) => {
        await using sandbox = await testdir();
        const path = scope === '' ? dependencyFile : `${scope}/${dependencyFile}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['licenses'], {
                scopes: scope === '' ? [] : [{ path: scope, configurations: ['licenses'] }],
                tables: LICENSE_TABLES,
            }),
            [path]: text,
        });

        using spawn = spyOn(processes, 'spawnProcess');
        expect(await captureRejection(runSandboxCheck(sandbox.path, 'licenses/allowed'))).toBe(
            `Install the project dependencies first: ${installedFolder} is missing in ${scope === '' ? 'the root' : scope}.`,
        );
        expect(spawn).not.toHaveBeenCalled();
        expect(await isOnDisk(join(sandbox.path, scope, installedFolder))).toBe(false);
    },
);

test.each([...SCANNER_FAILURES])(
    'scan: pip-licenses $name is an error, and gspot deletes its temporary folder',
    async ({ stdout, code, message }) => {
        await using sandbox = await testdir();
        await writeLicenseSandbox(sandbox.path, LICENSE_TABLES);
        await createFileTree(sandbox.path, {
            'app/pyproject.toml': SAMPLE_PYPROJECT,
            'app/.venv/installed': 'installed',
        });

        const folders: string[] = [];
        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'spawnProcess').mockImplementation((_argv, options) => {
                folders.push(options.cwd);
                return Promise.resolve(
                    folders.length === 1
                        ? buildProcessResult({ stdout: '[{"Name":"present","Version":"1.0.0","License":"MIT"}]' })
                        : buildProcessResult({ code, stderr: 'sample diagnostic', stdout }),
                );
            }),
        );
        const python = buildVenvExecutablePath(join(await realpath(sandbox.path), 'app/.venv'), 'python');
        expect(await captureRejection(runSandboxCheck(sandbox.path, 'licenses/allowed'))).toBe(message(python));
        expect(folders).toHaveLength(2);
        for (const folder of folders) {
            expect(folder).not.toBe(sandbox.path);
            expect(await isOnDisk(folder)).toBe(false);
        }
    },
);

test('scan: one scan reads package.json and pyproject.toml, accepts a license choice, and reports unknown licenses', async () => {
    await using sandbox = await testdir();
    await writeLicenseSandbox(sandbox.path, LICENSE_TABLES + SCAN_ALLOWED_PACKAGES);
    await fakeNpmTool(sandbox.path, 'license-checker-rseidelsohn');
    await createFileTree(sandbox.path, {
        'package.json': LICENSE_PACKAGE_JSON,
        'node_modules/installed': 'sample',
    });

    const folders: string[] = [];
    const nativeRun = processes.spawnProcess;
    using output = spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
        if (command[0] === 'git') return nativeRun(command, options);
        folders.push(options.cwd);
        return Promise.resolve(
            buildProcessResult({
                stdout: JSON.stringify(
                    command.some((argument) => argument.includes('license-checker-rseidelsohn'))
                        ? NPM_LICENSE_REPORT
                        : PYTHON_LICENSE_REPORT,
                ),
            }),
        );
    });
    const findings = await runSandboxCheck(sandbox.path, 'licenses/allowed');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual(
        EXPECTED_SCAN_FINDINGS.map(({ file, message }) => ({ file, line: 1, rule: 'disallowed-license', message })),
    );
    expect(output).toHaveBeenCalledTimes(2);
    expect(
        await Promise.all(
            folders.map(async (folder) => ({ isRoot: folder === sandbox.path, kept: await isOnDisk(folder) })),
        ),
    ).toStrictEqual([
        { isRoot: true, kept: true },
        { isRoot: false, kept: false },
    ]);
});

test('scan: a Python license comes from its SPDX expression, then its metadata, then its trove classifiers', async () => {
    await using sandbox = await testdir();
    await writeLicenseSandbox(sandbox.path, '[licenses]\nallowed = ["MIT", "BSD-3-Clause", "Apache-2.0"]\n');
    using _scan = spyOn(processes, 'spawnProcess').mockResolvedValue(
        buildProcessResult({
            stdout: JSON.stringify([...PYTHON_LICENSE_SOURCES]),
        }),
    );
    expect(await runSandboxCheck(sandbox.path, 'licenses/allowed')).toStrictEqual([
        matchFields({ rule: 'disallowed-license', message: 'copyleft@1.0.0 uses GPL-3.0-only, which is not allowed.' }),
    ]);
});

test('scan: licenses/allowed checks only the packages that the lockfile holds, and an allowed_package record covers a locked platform build', async () => {
    await using sandbox = await testdir();
    await writeLicenseSandbox(
        sandbox.path,
        `[licenses]\nallowed = ["MIT"]\n[[licenses.allowed_package]]\nname = "nvidia-*"\nversion = "*"\nreason = "The CUDA builds ship under the NVIDIA license."\n`,
    );
    await createFileTree(sandbox.path, {
        'uv.lock':
            '[[package]]\nname = "app"\nversion = "1.0.0"\n[[package]]\nname = "nvidia-cudnn-cu12"\nversion = "9.1.0"\n',
    });
    using _scan = spyOn(processes, 'spawnProcess').mockResolvedValue(
        buildProcessResult({
            stdout: JSON.stringify([
                { Name: 'app', Version: '1.0.0', 'License-Expression': 'MIT' },
                { Name: 'torch', Version: '2.5.0', 'License-Expression': 'LicenseRef-Host' },
            ]),
        }),
    );
    expect(await runSandboxCheck(sandbox.path, 'licenses/allowed')).toStrictEqual([]);
});

test('scan: the check skips with a note while licenses.allowed is empty', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['licenses']),
        'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n',
    });

    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['licenses/allowed'] }),
    );
    expect(report.checks).toMatchObject([
        { check: 'licenses/allowed', status: 'skipped', note: 'Set licenses.allowed to check licenses.' },
    ]);
});
// The scenario of a monorepo: each scope a Python project with its own environment and license report.
async function writeScopeLicenseSandbox(
    root: string,
    scenario: (typeof ALLOWED_PACKAGE_SCOPE_CASES)[number],
): Promise<void> {
    const ignore =
        'ignore' in scenario
            ? `[[ignore]]\ncheck = "licenses/allowed"\npaths = ["${scenario.ignore}/**"]\nreason = "Scope is intentionally outside this license run."\n`
            : '';
    const scopes = scenario.scopes.map((scope) => `[[scope]]\npath = "${scope}"\n`).join('');
    const settings = `${LICENSE_TABLES}[[licenses.allowed_package]]\nname = "Absent_Package"\nversion = "2.0.0"\n${ALLOWED_PACKAGE_REASON}${ignore}${scopes}`;
    const projects = Object.keys(scenario.reports).flatMap((scope): [string, string][] => [
        [join(scope, 'pyproject.toml'), SAMPLE_PYPROJECT],
        [join(scope, '.venv/installed'), 'installed'],
    ]);
    await writeLicenseSandbox(root, settings, {
        ...Object.fromEntries(projects),
        ...scenario.lockfiles,
        ...LICENSE_TOOL_PROJECT_FILES,
    });
}

// Write the settings and project files, and a pip-licenses of the pinned version in the tool environment.
async function writeLicenseSandbox(
    root: string,
    settings: string,
    files: Record<string, string> = LICENSE_PROJECT_FILES,
): Promise<void> {
    await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['licenses'], { tables: settings }), ...files });
    const version = getTool(readConfigurations().values(), 'pip-licenses').version;
    if (version === undefined) throw new Error('The pip-licenses test requires a pinned version.');
    await writeScriptCommand(
        root,
        relative(root, join(buildVenvBinPath(join(root, GSPOT_PATHS.pythonEnvironment)), 'pip-licenses')),
        `console.log(${JSON.stringify('pip-licenses ' + version)});`,
    );
}
