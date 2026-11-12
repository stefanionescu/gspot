import { mkdir, symlink } from 'node:fs/promises';
import { delimiter, dirname, extname, join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import semver from 'semver';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { MISE_INSTALL_URL } from '#cli/config/tools/programs.ts';
import { openSession } from '#cli/engine/session.ts';
import { getTool, listDistinctTools, readConfigurations } from '#cli/manifests/read.ts';
import { executableLayout } from '#cli/system/paths.ts';
import * as locate from '#cli/tools/locate.ts';
import { findPackagePin } from '#cli/tools/pins.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { APP_PYPROJECT } from '#tests/config/setup/languages.ts';
import { doctorOutputSchema } from '#tests/schemas/setup.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

function selectExecutableFolder(tool: Tool): string {
    const installation = findPackagePin(tool);
    if (installation?.kind === 'npm') return join(GSPOT_PATHS.nodeModules, '.bin');
    return installation?.kind === 'python'
        ? join(GSPOT_PATHS.pythonEnvironment, executableLayout.environmentFolder)
        : 'test-tools';
}

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
        const report = doctorOutputSchema.parse(JSON.parse(result.stdout));
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
    const tools = doctorOutputSchema.parse(JSON.parse(report.stdout)).tools;
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
    const report = doctorOutputSchema.parse(JSON.parse(result.stdout));
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

test('doctor and gspot check report a missing xmllint with its install command', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'project');
    const binaries = join(sandbox.path, 'binaries');
    await mkdir(binaries);
    for (const name of ['git', 'node']) {
        const executable = Bun.which(name);
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
    expect(
        doctorOutputSchema.parse(JSON.parse(doctor.stdout)).tools.find(({ name }) => name === 'xmllint'),
    ).toStrictEqual({
        name: 'xmllint',
        kind: 'program',
        state: 'missing',
        help,
    });
    const checked = parseCheckReport(
        await runGspot(root, ['check', 'document.xml', '--only', 'xml/xmllint', '--json'], environment),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(checked.report.checks).toMatchObject([
        { check: 'xml/xmllint', status: 'missing', findings: [], note: expect.stringContaining(help) as string },
    ]);
});

test('doctor lists programs by name and folds the npm packages into one line', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['javascript']) });
    using _lookup = fakeExecutableLookup(null);
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.code).toBe(1);
    expect(result.stdout).toMatch(/^ {2}missing +eslint /mu);
    expect(result.stdout).not.toContain('eslint-plugin-');
});

test('doctor --json reports every field when the required tools are missing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    using _lookup = fakeExecutableLookup(null);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(result.code).toBe(1);
    const report = doctorOutputSchema.parse(JSON.parse(result.stdout));
    expect(report.tools.filter(({ state }) => state !== 'missing')).toStrictEqual([]);
    const prettier = String(getTool(readConfigurations().values(), 'prettier').version);
    expect(report.tools).toContainEqual({
        name: 'prettier',
        kind: 'program',
        state: 'missing',
        help: 'Run gspot install.',
        want: prettier,
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
    expect(doctorOutputSchema.parse(JSON.parse(diagnosed.stdout)).environments).toStrictEqual(['.venv']);
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
    const report = doctorOutputSchema.parse(JSON.parse(result.stdout));
    const names = report.tools.map(({ name }) => name).filter((name) => ['swift', 'xcodebuild'].includes(name));
    expect(names).toStrictEqual([...tools]);
});

test('doctor prints the install help of a missing system tool, because gspot install cannot install it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['pytest'], { tables: '[coverage]\nmin_line_percent = 80\n' }),
        'test_main.py': 'def test_value():\n    assert True\n',
    });
    const { listExecutablePaths } = locate;
    using _paths = spyOn(locate, 'listExecutablePaths').mockImplementation(async (root, program, search) =>
        program === 'pytest' ? { paths: [] } : await listExecutablePaths(root, program, search),
    );
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.stdout).toContain('Run python -m pip install pytest.');
    expect(result.stdout).toContain('Install pytest-cov in the Python environment used by pytest.');
    const report = await runGspot(sandbox.path, ['doctor', '--json']);
    const npmPackages = doctorOutputSchema
        .parse(JSON.parse(report.stdout))
        .tools.filter(({ kind, name }) => kind === 'package' && name !== 'pytest-cov');
    expect(result.stdout).toContain(`missing npm packages: ${String(npmPackages.length)} (run gspot install)`);
});

test('with no mise on PATH, doctor names mise and the tools that mise installs', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    using _lookup = fakeExecutableLookup(null);
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.code).toBe(1);
    const prefix = `mise is not on PATH. Install mise (${MISE_INSTALL_URL}), or install these tools yourself: `;
    const line = result.stdout.split('\n').find((each) => each.startsWith(prefix));
    expect(line?.slice(prefix.length, -1).split(', ')).toContain('taplo');
});
