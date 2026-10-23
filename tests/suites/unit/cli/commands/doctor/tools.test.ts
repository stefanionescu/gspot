import semver from 'semver';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { buildVenvBinPath } from '#cli/system/paths.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { type DoctorReport } from '#cli/types/commands/doctor.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { join, dirname, extname, basename, delimiter } from 'node:path';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { ZERO_COVERAGE_TABLES } from '#tests/config/commands/doctor/tools.ts';
import { fakeToolExecutables, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { getTool, listDistinctTools, findToolProjectPackage } from '#cli/configurations/tools.ts';

test('doctor reports no unowned gspot files in a fresh clone', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await createFileTree(source, { 'gspot.toml': buildSandboxSettings([]) });
    runGitStep(source, ['init', '-q']);
    const applied = await runGspot(source, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    commitAll(source);
    runGitStep(sandbox.path, ['clone', '--quiet', source, checkout]);
    const result = await runGspot(checkout, ['doctor', '--json']);
    const resultText = await runGspot(checkout, ['doctor']);
    expect(JSON.parse(result.stdout)).toMatchObject({ suggestions: { unowned: [] } });
    expect(resultText.stdout).not.toContain('config files gspot does not own');
});
test.each(['ok', 'newer', 'outdated'] as const)(
    'doctor exit code follows the library state %s: an outdated tool exits 1',
    async (state) => {
        await using sandbox = await testdir();
        const pin = getTool(readConfigurations().values(), 'eslint-plugin-zod');
        const minimum = semver.parse(pin.min_version ?? pin.version!)!;
        let earlierVersion = `${String(minimum.major - 1)}.0.0`;
        if (minimum.minor > 0) earlierVersion = `${String(minimum.major)}.${String(minimum.minor - 1)}.0`;
        if (minimum.patch > 0)
            earlierVersion = `${String(minimum.major)}.${String(minimum.minor)}.${String(minimum.patch - 1)}`;
        const versions = { ok: pin.version!, newer: semver.inc(pin.version!, 'minor')!, outdated: earlierVersion };
        const version = versions[state];
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['zod']),
            'source.js': 'export const value = 1;\n',
        });
        const session = await openSession(sandbox.path);
        const tools = listDistinctTools(session.toolConfigurations);
        await createFileTree(
            sandbox.path,
            Object.fromEntries(
                tools.map((tool) => {
                    if (tool.kind === 'library') {
                        const name = tool.installers['npm']!.name;
                        return [
                            join(GSPOT_PATHS.nodeModules, name, 'package.json'),
                            JSON.stringify({ name, version: tool.name === pin.name ? version : tool.version }),
                        ];
                    }
                    const installation = findToolProjectPackage(tool);
                    let folder = 'test-tools';
                    if (installation?.kind === 'npm') folder = join(GSPOT_PATHS.nodeModules, '.bin');
                    else if (installation?.kind === 'python') folder = buildVenvBinPath(GSPOT_PATHS.pythonEnvironment);
                    return [join(folder, tool.name), 'native lookup target'];
                }),
            ),
        );
        using resources = new DisposableStack();
        resources.use(fakeToolExecutables(tools));
        const result = await runGspot(sandbox.path, ['doctor', '--json']);
        const report = JSON.parse(result.stdout) as DoctorReport;
        expect(report.tools.find((tool) => tool.name === pin.name)).toMatchObject({ state, found: version });
        expect(result.code).toBe(state === 'outdated' ? 1 : 0);
    },
);

test('doctor lists a tool once when two scopes find the same install', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['zod'], { scopes: [{ path: 'app', configurations: ['zod'] }] }),
        'source.js': 'export const value = 1;\n',
        'app/source.js': 'export const value = 1;\n',
    });

    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    const report = JSON.parse(result.stdout) as DoctorReport;
    expect(report.tools.filter(({ name }) => name === 'eslint-plugin-zod')).toHaveLength(1);
});

test('doctor names a missing coverage plugin and leaves it out when every coverage limit is zero', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'pytest'], { level: 'all', tables: '[coverage]\nlines = 80\n' }),
        'test_math.py': '',
    });

    const session = await openSession(sandbox.path);
    const tools = listDistinctTools(session.toolConfigurations);
    using _which = fakeExecutableLookup(join(sandbox.path, 'tool-bin', 'pytest'));
    const nativeVersion = processes.spawnProcessBlocking;
    let present = false;
    using _version = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
        if (command.slice(1).join(' ') === '--version --version')
            return buildProcessResult({ stdout: present ? 'pytest-cov-7.1.0' : 'pytest 9.1.1' });
        const pin = tools.find((tool) => tool.name === basename(command[0] ?? ''));
        const version = pin?.version ?? pin?.min_version;
        if (version === undefined) return nativeVersion(command, options);
        return buildProcessResult({ stdout: version });
    });
    const missing = await runGspot(sandbox.path, ['doctor', '--json']);
    const missingText = await runGspot(sandbox.path, ['doctor']);
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
    const findPytestCov = (output: string) =>
        (JSON.parse(output) as DoctorReport).tools.find(({ name }) => name === 'pytest-cov');
    const pytestCov = {
        name: 'pytest-cov',
        path: join(sandbox.path, 'tool-bin', 'pytest'),
        help: 'Install pytest-cov in the Python environment used by pytest.',
    };
    expect(findPytestCov(missing.stdout)).toStrictEqual({
        ...pytestCov,
        state: 'missing',
        note: 'The version command of the host tool does not list pytest-cov.',
    });
    expect(missingText.stdout.split('\n').filter((line) => line.includes('pytest-cov'))).toStrictEqual([
        '  missing   pytest-cov                    The version command of the host tool does not list pytest-cov. Install pytest-cov in the Python environment used by pytest.',
    ]);
    present = true;
    const available = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(findPytestCov(available.stdout)).toStrictEqual({ ...pytestCov, state: 'system', found: '7.1.0' });
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['python', 'pytest'], { level: 'all', tables: ZERO_COVERAGE_TABLES }),
    );
    const zero = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(zero.stdout) as DoctorReport).tools.map((tool) => tool.name)).not.toContain('pytest-cov');
});
test('doctor and gspot check report a missing xmllint with its install command', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'project');
    const binaries = join(sandbox.path, 'binaries');
    await mkdir(binaries);
    for (const name of ['git', 'node']) {
        const executable = Bun.which(name);
        expect(executable, `${name} is required for CLI metadata inspection.`).not.toBeNull();
        if (name === 'git' && isWindows) continue;
        const filename = name + extname(executable!);
        await symlink(executable!, join(binaries, filename));
    }
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([]),
        'document.xml': '<root />\n',
        'package.json': '{"private":true,"packageManager":"npm@10.9.0"}\n',
    });
    const help = 'Install xmllint.';
    const environment = {
        PATH: [binaries, ...(isWindows ? [dirname(Bun.which('git')!)] : [])].join(delimiter),
        MISE_DATA_DIR: join(sandbox.path, 'mise'),
    };
    const doctor = await runGspot(root, ['doctor', '--json'], environment);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    expect((JSON.parse(doctor.stdout) as DoctorReport).tools.find(({ name }) => name === 'xmllint')).toStrictEqual({
        name: 'xmllint',
        state: 'missing',
        help,
    });
    const checked = parseCheckReport(
        await runGspot(root, ['check', 'document.xml', '--only', 'data-files/xmllint', '--json'], environment),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(checked.report.checks).toMatchObject([
        { check: 'data-files/xmllint', status: 'missing', findings: [], note: `xmllint is not installed. ${help}` },
    ]);
});
