import semver from 'semver';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildVenvBinPath } from '#cli/system/paths.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { type DoctorReport } from '#cli/types/commands/doctor.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { join, dirname, extname, basename, delimiter } from 'node:path';
import { GSPOT_NODE_MODULES_PATH, GSPOT_PYTHON_ENVIRONMENT_PATH } from '#cli/config/gspot-paths.ts';
import { getTool, listDistinctTools, findToolProjectPackage } from '#cli/configurations/declared-tools.ts';

test('doctor reports no unowned gspot files in a fresh clone', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await createFileTree(source, { 'gspot.toml': buildSandboxSettings([]) });
    readGitOutput(source, ['init', '-q']);
    const applied = await runGspot(source, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    commitAll(source);
    readGitOutput(sandbox.path, ['clone', '--quiet', source, checkout]);
    const result = await runGspot(checkout, ['doctor', '--json']);
    const resultText = await runGspot(checkout, ['doctor']);
    expect(JSON.parse(result.stdout)).toMatchObject({ suggestions: { unowned: [] } });
    expect(resultText.stdout).not.toContain('tool files gspot does not own');
});
test.each(['ok', 'newer', 'outdated'] as const)(
    'doctor exit code follows the library state %s: an outdated tool exits 1',
    async (state) => {
        await using sandbox = await testdir();
        const pin = getTool(readConfigurations().values(), 'eslint-plugin-zod');
        const floor = semver.parse(pin.min_version ?? pin.version!)!;
        let earlierVersion = `${String(floor.major - 1)}.0.0`;
        if (floor.minor > 0) earlierVersion = `${String(floor.major)}.${String(floor.minor - 1)}.0`;
        if (floor.patch > 0)
            earlierVersion = `${String(floor.major)}.${String(floor.minor)}.${String(floor.patch - 1)}`;
        const versions = { ok: pin.version!, newer: semver.inc(pin.version!, 'minor')!, outdated: earlierVersion };
        const version = versions[state];
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['zod']),
            'source.js': 'export const value = 1;\n',
        });
        const session = await openSession(sandbox.path);
        const tools = listDistinctTools(session.neededToolConfigurations);
        await createFileTree(
            sandbox.path,
            Object.fromEntries(
                tools.map((tool) => {
                    if (tool.kind === 'library') {
                        const name = tool.installers['npm']!.name;
                        return [
                            `.gspot/node_modules/${name}/package.json`,
                            JSON.stringify({ name, version: tool.name === pin.name ? version : tool.version }),
                        ];
                    }
                    const installation = findToolProjectPackage(tool);
                    let folder = 'test-tools';
                    if (installation?.kind === 'npm') folder = join(GSPOT_NODE_MODULES_PATH, '.bin');
                    else if (installation?.kind === 'python') folder = buildVenvBinPath(GSPOT_PYTHON_ENVIRONMENT_PATH);
                    return [join(folder, tool.name), 'native lookup target'];
                }),
            ),
        );
        using resources = new DisposableStack();
        resources.use(fakePinnedExecutables(tools));
        const result = await runGspot(sandbox.path, ['doctor', '--json']);
        const report = JSON.parse(result.stdout) as DoctorReport;
        expect(report.tools.find((tool) => tool.name === pin.name)).toMatchObject({ state, found: version });
        expect(result.code).toBe(state === 'outdated' ? 1 : 0);
    },
);

test('doctor names a missing coverage plugin and leaves it out when every coverage limit is zero', async () => {
    const level = 'all';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'pytest'], { level, tables: '[coverage]\nlines = 80\n' }),
        'test_math.py': '',
    });

    const session = await openSession(sandbox.path);
    const tools = listDistinctTools(session.neededToolConfigurations);
    using _which = useExecutable(join(sandbox.path, 'tool-bin', 'pytest'));
    const nativeVersion = processes.spawnProcessBlocking;
    let present = false;
    using _version = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
        if (command.slice(1).join(' ') === '--version --version')
            return buildProcessResult({
                code: 0,
                stdout: present ? 'pytest-cov-7.1.0' : 'pytest 9.1.1',
                stderr: '',
                missing: false,
                duration: 1,
            });
        const pin = tools.find((tool) => tool.name === basename(command[0] ?? ''));
        const version = pin?.version ?? pin?.min_version;
        if (version === undefined) return nativeVersion(command, options);
        return buildProcessResult({ code: 0, stdout: version, stderr: '', missing: false, duration: 1 });
    });
    const missing = await runGspot(sandbox.path, ['doctor', '--json']);
    const missingText = await runGspot(sandbox.path, ['doctor']);
    expect((JSON.parse(missing.stdout) as DoctorReport).tools).toContainEqual(
        matchFields({ name: 'pytest-cov', state: 'missing' }),
    );
    expect(missingText.stdout).toContain('pytest-cov');
    present = true;
    const available = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(available.stdout) as DoctorReport).tools).toContainEqual(
        matchFields({ name: 'pytest-cov', state: 'system', found: '7.1.0' }),
    );
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['python', 'pytest'], {
            level,
            tables: `[coverage]
lines = { value = 0, reason = "This sandbox tests optional coverage." }
branches = { value = 0, reason = "This sandbox tests optional coverage." }
functions = { value = 0, reason = "This sandbox tests optional coverage." }
statements = { value = 0, reason = "This sandbox tests optional coverage." }
`,
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
    const hint = 'Install xmllint.';
    const environment = {
        PATH: [binaries, ...(isWindows ? [dirname(Bun.which('git')!)] : [])].join(delimiter),
        MISE_DATA_DIR: join(sandbox.path, 'mise'),
    };
    const doctor = await runGspot(root, ['doctor', '--json'], environment);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    expect((JSON.parse(doctor.stdout) as DoctorReport).tools).toContainEqual(
        matchFields({ name: 'xmllint', state: 'missing', hint }),
    );
    const checked = parseCheckReport(
        await runGspot(root, ['check', 'document.xml', '--only', 'files/xmllint', '--json'], environment),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(checked.report.checks).toMatchObject([
        { check: 'files/xmllint', status: 'missing', findings: [], note: `xmllint is not installed. ${hint}` },
    ]);
});
