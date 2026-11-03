import semver from 'semver';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import type { Tool } from '#cli/types/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { executableLayout } from '#cli/system/paths.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { APP_PYPROJECT } from '#tests/config/setup/languages.ts';
import type { DoctorReport } from '#cli/types/commands/reports.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { join, dirname, extname, basename, delimiter } from 'node:path';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getTool, findPackagePin, listDistinctTools } from '#cli/tools/pins.ts';
import { fakeCommands, fakeToolExecutables, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

function selectExecutableFolder(tool: Tool): string {
    const installation = findPackagePin(tool);
    if (installation?.kind === 'npm') return join(GSPOT_PATHS.nodeModules, '.bin');
    return installation?.kind === 'python'
        ? join(GSPOT_PATHS.pythonEnvironment, executableLayout.environmentFolder)
        : 'test-tools';
}

test('doctor reports no unowned gspot files in a fresh clone', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await createFileTree(source, { 'gspot.toml': buildSandboxSettings([]) });
    runGitStep(source, ['init', '-q']);
    await applyGeneratedFiles(source);
    commitAll(source);
    runGitStep(sandbox.path, ['clone', '--quiet', source, checkout]);
    const result = await runGspot(checkout, ['doctor', '--json']);
    expect(JSON.parse(result.stdout)).toMatchObject({ suggestions: { unowned: [] } });
});

test.each(['ok', 'newer', 'outdated'] as const)(
    'doctor exit code follows the library state %s: an outdated tool exits 1',
    async (state) => {
        await using sandbox = await createGitSandbox({});
        const pin = getTool(readConfigurations().values(), 'eslint-plugin-zod');
        const versions = { ok: pin.version!, newer: semver.inc(pin.version!, 'major')!, outdated: '0.0.0' };
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
                    if (tool.kind === 'package') {
                        const name = tool.installers['npm']!.name;
                        return [
                            join(GSPOT_PATHS.nodeModules, name, 'package.json'),
                            JSON.stringify({ name, version: tool.name === pin.name ? version : tool.version }),
                        ];
                    }
                    return [join(selectExecutableFolder(tool), tool.name), 'native lookup target'];
                }),
            ),
        );
        using resources = new DisposableStack();
        resources.use(fakeToolExecutables(tools));
        const result = await runGspot(sandbox.path, ['doctor', '--json']);
        expect(result.code, result.stdout + result.stderr).not.toBe(2);
        const report = JSON.parse(result.stdout) as DoctorReport;
        expect(report.tools.find((tool) => tool.name === pin.name)).toMatchObject({ state, found: version });
        expect(result.code).toBe(state === 'outdated' ? 1 : 0);
    },
);

test.each([
    { result: { code: 134, stderr: 'dyld: Library not loaded' }, state: 'error', row: 'dyld: Library not loaded' },
    { result: { stdout: 'taplo 0.0.1' }, state: 'outdated', row: 'taplo 0.0.1 (below' },
    { result: { stdout: 'taplo 99.0.0' }, state: 'newer', row: 'taplo 99.0.0 (pinned' },
])('doctor runs a program in its mise folder and reports $state', async ({ result, state, row }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(fakeToolExecutables(listDistinctTools(session.toolConfigurations)));
    using _taplo = fakeCommands('taplo', () => Promise.resolve(buildProcessResult(result)));
    const report = await runGspot(sandbox.path, ['doctor', '--json']);
    const tools = (JSON.parse(report.stdout) as DoctorReport).tools;
    expect(tools.find(({ name }) => name === 'taplo')).toMatchObject({ state });
    const printed = await runGspot(sandbox.path, ['doctor']);
    expect(printed.stdout).toContain(row);
});

test('doctor lists a tool once when two scopes find the same install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['zod'], { scopes: [{ path: 'app', configurations: ['zod'] }] }),
        'source.js': 'export const value = 1;\n',
        'app/source.js': 'export const value = 1;\n',
    });

    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(result.code, result.stdout + result.stderr).not.toBe(2);
    const report = JSON.parse(result.stdout) as DoctorReport;
    expect(report.tools.filter(({ name }) => name === 'eslint-plugin-zod')).toStrictEqual([
        {
            name: 'eslint-plugin-zod',
            kind: 'package',
            state: 'missing',
            help: 'Run gspot install.',
            want: getTool(readConfigurations().values(), 'eslint-plugin-zod').version!,
        },
    ]);
});

test('doctor names a missing coverage plugin and leaves it out when every coverage limit is zero', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'pytest'], {
            level: 'all',
            tables: '[coverage]\nmin_line_percent = 80\n',
        }),
        'test_math.py': '',
    });

    const session = await openSession(sandbox.path);
    const tools = listDistinctTools(session.toolConfigurations);
    await using programs = await testdir();
    using _which = fakeExecutableLookup(join(programs.path, 'pytest'));
    const nativeVersion = processes.runProcess;
    let isPresent = false;
    using _version = spyOn(processes, 'runProcess').mockImplementation(async (command, options) => {
        if (command.slice(1).join(' ') === '--version --version')
            return buildProcessResult({ stdout: isPresent ? 'pytest-cov-7.1.0' : 'pytest 9.1.1' });
        const pin = tools.find((tool) => tool.name === basename(command[0] ?? ''));
        const version = pin?.version ?? pin?.min_version;
        return version === undefined ? await nativeVersion(command, options) : buildProcessResult({ stdout: version });
    });
    const missing = await runGspot(sandbox.path, ['doctor', '--json']);
    const pytestCov = {
        name: 'pytest-cov',
        kind: 'package' as const,
        path: join(programs.path, 'pytest'),
        help: 'Install pytest-cov in the Python environment used by pytest.',
    };
    expect((JSON.parse(missing.stdout) as DoctorReport).tools.find(({ name }) => name === 'pytest-cov')).toStrictEqual({
        ...pytestCov,
        state: 'missing',
        note: 'The version command of the host tool does not list pytest-cov.',
    });
    isPresent = true;
    const available = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(
        (JSON.parse(available.stdout) as DoctorReport).tools.find(({ name }) => name === 'pytest-cov'),
    ).toStrictEqual({ ...pytestCov, state: 'system', found: '7.1.0' });
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['python', 'pytest'], {
            level: 'all',
            tables: '[coverage]\nmin_line_percent = { value = 0, reason = "This sandbox tests optional coverage." }\n',
        }),
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
    runGitStep(root, ['init', '--quiet']);
    const help = 'Install xmllint.';
    const environment = {
        PATH: [binaries, ...(isWindows ? [dirname(Bun.which('git')!)] : [])].join(delimiter),
        MISE_DATA_DIR: join(sandbox.path, 'mise'),
    };
    const doctor = await runGspot(root, ['doctor', '--json'], environment);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    expect((JSON.parse(doctor.stdout) as DoctorReport).tools.find(({ name }) => name === 'xmllint')).toStrictEqual({
        name: 'xmllint',
        kind: 'program',
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

test('doctor lists programs by name and folds the npm packages into one line', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['javascript']) });
    using _lookup = fakeExecutableLookup(null);
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('prettier');
    expect(result.stdout).not.toContain('eslint-plugin-');
    expect(result.stdout).toMatch(/^missing npm packages: \d+ \(run gspot install\)$/mu);
});

test('doctor --json reports every field when the required tools are missing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    using _lookup = fakeExecutableLookup(null);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(result.code).toBe(1);
    const report = JSON.parse(result.stdout) as DoctorReport;
    expect(report.tools.filter(({ state }) => state !== 'missing')).toStrictEqual([]);
    const prettier = String(getTool(readConfigurations().values(), 'prettier').version);
    const taplo = String(getTool(readConfigurations().values(), 'taplo').version);
    expect(report.tools).toContainEqual({
        name: 'prettier',
        kind: 'program',
        state: 'missing',
        help: 'Run gspot install.',
        want: prettier,
    });
    expect(report.tools).toContainEqual({
        name: 'taplo',
        kind: 'program',
        state: 'missing',
        help: `Install mise (https://mise.jdx.dev/getting-started.html), or install taplo ${taplo} yourself.`,
        want: taplo,
    });
    expect(report).toMatchObject({
        submodules: [],
        environments: [],
        suggestions: { suggested: [], undetected: [], unowned: [], lintCommands: [] },
        hooks: { ready: true },
        ci: { enabled: false },
        ruleFileCount: 0,
    });
});

test('doctor reports a missing project environment of a Python scope and exits 1', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { scopes: [{ path: 'api', configurations: ['python'] }] }),
        'pyproject.toml': APP_PYPROJECT,
        'api/pyproject.toml': APP_PYPROJECT,
        'api/.venv/pyvenv.cfg': 'home = /usr/bin\n',
    });
    const diagnosed = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(diagnosed.code, diagnosed.stdout + diagnosed.stderr).toBe(1);
    expect((JSON.parse(diagnosed.stdout) as DoctorReport).environments).toStrictEqual(['.venv']);
});

test.each([
    { name: 'a Swift package', tables: '', tools: ['swift'] },
    {
        name: 'an Xcode project',
        tables: '[swift]\nxcode_project = "App.xcodeproj"\nxcode_scheme = "App"\n',
        tools: ['swift', 'xcodebuild'],
    },
])('doctor reports the Swift toolchain of $name', async ({ tables, tools }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], { tables }),
        'Package.swift': '// swift-tools-version: 6.0\n',
    });
    using _lookup = fakeExecutableLookup(null);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    const report = JSON.parse(result.stdout) as DoctorReport;
    const names = report.tools.map(({ name }) => name).filter((name) => ['swift', 'xcodebuild'].includes(name));
    expect(names).toStrictEqual([...tools]);
});
