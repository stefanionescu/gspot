import semver from 'semver';
import executables from 'which';
import { test, spyOn, expect } from 'bun:test';
import { readTree } from '#tests/setup/files.ts';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { gitOutput, commitAll } from '#tests/setup/git.ts';
import { virtualEnvironmentBin } from '#cli/system/paths.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { doctorCommand } from '#cli/commands/doctor/command.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { containing, containingAll } from '#tests/setup/matchers.ts';
import { join, dirname, extname, basename, delimiter } from 'node:path';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { collectPins, toolDeclaration, toolProjectPackage } from '#cli/configurations/tool-pins.ts';
import { NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/system/locations.ts';

test('doctor reports no unowned gspot files in a fresh clone', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await createFileTree(source, { 'gspot.toml': settingsText([]) });
    gitOutput(source, ['init', '-q']);
    {
        using writer = openWriter(source);
        const session = await openSession(source);
        writeGeneratedFiles(session, emitAll(session), writer);
    }
    commitAll(source);
    gitOutput(sandbox.path, ['clone', '--quiet', source, checkout]);
    const result = await doctorCommand(checkout);
    expect(result.json).toMatchObject({ suggestions: { unowned: [] } });
    expect(result.text).not.toContain('configuration not owned');
});

test('doctor reports Python and submodules and does not treat tool projects as source', async () => {
    await using sandbox = await testdir();
    const python = `[project]
name = "example"
version = "1.0.0"
dependencies = ["pytest==8.4.2"]
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([]),
        '.gspot/pyproject.toml': python,
        'nested/.gspot/package.json': '{"dependencies":{"react":"19.1.1"}}',
    });
    const privateOnly = await doctorCommand(sandbox.path);
    const detected = (privateOnly.json as DoctorReport).suggestions.detected.map(({ configuration }) => configuration);
    expect(detected).not.toContain('python');
    expect(detected).not.toContain('react');
    expect(detected).not.toContain('files');
    await writeFile(join(sandbox.path, 'pyproject.toml'), python);
    const authored = await doctorCommand(sandbox.path);
    expect(authored.json).toMatchObject({
        suggestions: {
            detected: containingAll([containing({ configuration: 'python', evidence: 'pyproject.toml' })]),
        },
    });
    expect(await readFile(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(python);
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-qm', 'Source']);
    const commit = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const path = 'vendor/external project';
    gitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commit},${path}`]);
    const result = await doctorCommand(sandbox.path);
    expect(result.json).toMatchObject({ submodules: [path] });
});

test('doctor suggests the command that adds the configuration of a new Python file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['bash']),
        'entry.sh': 'echo\n',
    });
    {
        using log = openWriter(sandbox.path);
        const session = await openSession(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
    }
    await writeFile(join(sandbox.path, 'service.py'), 'print("hello")\n');
    const result = await doctorCommand(sandbox.path);
    const { suggestions } = result.json as DoctorReport;
    expect(suggestions.detected).toContainEqual(containing({ configuration: 'python', command: 'gspot add python' }));
});

test.each(['ok', 'newer', 'outdated'] as const)(
    'doctor exit code follows the library state %s: an outdated tool exits 1',
    async (state) => {
        await using sandbox = await testdir();
        const pin = toolDeclaration(configurationManifests().values(), 'eslint-plugin-zod');
        const floor = semver.parse(pin.min_version ?? pin.version!)!;
        let older = `${String(floor.major - 1)}.0.0`;
        if (floor.minor > 0) older = `${String(floor.major)}.${String(floor.minor - 1)}.0`;
        if (floor.patch > 0) older = `${String(floor.major)}.${String(floor.minor)}.${String(floor.patch - 1)}`;
        const versions = { ok: pin.version!, newer: semver.inc(pin.version!, 'minor')!, outdated: older };
        const version = versions[state];
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['zod']),
            'source.js': 'export const value = 1;\n',
        });
        const awaitedSession = await openSession(sandbox.path);
        const tools = collectPins(awaitedSession.neededToolManifests);
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
                    const installation = toolProjectPackage(tool);
                    let folder = 'test-tools';
                    if (installation?.kind === 'npm') folder = join(NODE_MODULES_DIRECTORY, '.bin');
                    else if (installation?.kind === 'python')
                        folder = virtualEnvironmentBin(PYTHON_ENVIRONMENT_DIRECTORY);
                    return [join(folder, tool.name), 'native lookup target'];
                }),
            ),
        );
        using resources = new DisposableStack();
        resources.use(mockPinnedExecutables(tools));
        const result = await doctorCommand(sandbox.path);
        const report = result.json as DoctorReport;
        expect(report.tools.find((tool) => tool.name === pin.name)).toMatchObject({ state, found: version });
        expect(result.exitCode).toBe(state === 'outdated' ? 1 : 0);
    },
);

test('doctor detects installed test frameworks and suggests no other runner', async () => {
    await using sandbox = await testdir();
    const settings = settingsText(['nestjs']);
    const dependencies = { '@nestjs/core': '11.2.3', jest: '30.2.0' };
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'package.json': JSON.stringify({ name: 'service', private: true, dependencies }),
        'src/server.ts': 'export const port = 3000;\n',
    });
    const currentResult = await doctorCommand(sandbox.path);
    const current = currentResult.json as DoctorReport;
    expect(current.suggestions.suggested.map((row) => row.configuration)).not.toContain('vitest');
    expect(current.suggestions.detected.map((row) => row.configuration)).toContain('jest');
    await Bun.write(
        join(sandbox.path, 'package.json'),
        JSON.stringify({ name: 'service', private: true, dependencies: { ...dependencies, vitest: '4.1.11' } }),
    );
    const changedResult = await doctorCommand(sandbox.path);
    const changed = changedResult.json as DoctorReport;
    expect(changed.suggestions.detected.map((row) => row.configuration)).toContain('vitest');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings);
});

test('doctor names a missing coverage plugin and leaves it out when every coverage limit is zero', async () => {
    const level = 'all';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python', 'pytest'], { level, tables: '[coverage]\nlines = 80\n' }),
        'test_math.py': '',
    });
    const session = await openSession(sandbox.path);
    const tools = collectPins(session.neededToolManifests);
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) => {
        const path = join(sandbox.path, 'tool-bin', 'pytest');
        return options?.all === true ? [path] : path;
    }) as typeof executables.sync);
    const nativeVersion = processes.runBlocking;
    let present = false;
    using _version = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command.slice(1).join(' ') === '--version --version')
            return {
                code: 0,
                stdout: present ? 'pytest-cov-7.1.0' : 'pytest 9.1.1',
                stderr: '',
                missing: false,
                duration: 1,
            };
        const pin = tools.find((tool) => tool.name === basename(command[0] ?? ''));
        const version = pin?.version ?? pin?.min_version;
        if (version === undefined) return nativeVersion(command, options);
        return { code: 0, stdout: version, stderr: '', missing: false, duration: 1 };
    });
    const missing = await doctorCommand(sandbox.path);
    expect((missing.json as DoctorReport).tools).toContainEqual(containing({ name: 'pytest-cov', state: 'missing' }));
    expect(missing.text).toContain('pytest-cov');
    present = true;
    const available = await doctorCommand(sandbox.path);
    expect((available.json as DoctorReport).tools).toContainEqual(
        containing({ name: 'pytest-cov', state: 'system', found: '7.1.0' }),
    );
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        settingsText(['python', 'pytest'], {
            level,
            tables: `[coverage]
lines = { value = 0, reason = "This sandbox tests optional coverage." }
branches = { value = 0, reason = "This sandbox tests optional coverage." }
functions = { value = 0, reason = "This sandbox tests optional coverage." }
statements = { value = 0, reason = "This sandbox tests optional coverage." }
`,
        }),
    );
    const zero = await doctorCommand(sandbox.path);
    expect((zero.json as DoctorReport).tools.map((tool) => tool.name)).not.toContain('pytest-cov');
});

test('doctor suggests a remove command per scope after detection evidence goes, and changes nothing', async () => {
    const level = 'all';
    await using sandbox = await testdir();
    const settings = settingsText(['bash'], {
        level,
        tables: `[[scope]]
path = "api app"
configurations = ["python"]
[[scope]]
path = "api app/deep"
`,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'entry.sh': 'echo ready\n',
        'api app/service.py': 'print("ready")\n',
        'api app/deep/README.md': '# Service\n',
        'sibling/service.py': 'print("sibling")\n',
    });
    const present = await doctorCommand(sandbox.path);
    expect((present.json as DoctorReport).suggestions.undetected).toStrictEqual([]);
    await rm(join(sandbox.path, 'entry.sh'));
    await rm(join(sandbox.path, 'api app/service.py'));
    const before = await readTree(sandbox.path);
    const missing = await doctorCommand(sandbox.path);
    expect((missing.json as DoctorReport).suggestions.undetected).toStrictEqual([
        {
            configuration: 'bash',
            evidence: 'no detection evidence in root',
            command: 'gspot remove bash (if you no longer need it)',
        },
        {
            configuration: 'python',
            evidence: 'no detection evidence in api app',
            command: "gspot remove python --scope 'api app' (if you no longer need it)",
        },
    ]);
    expect(missing.text).toContain('selected, but no matching files found');
    expect(missing.text).toContain("gspot remove python --scope 'api app'");
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    await writeFile(join(sandbox.path, 'entry.sh'), 'echo ready\n');
    await writeFile(join(sandbox.path, 'api app/service.py'), 'print("ready")\n');
    const restored = await doctorCommand(sandbox.path);
    expect((restored.json as DoctorReport).suggestions.undetected).toStrictEqual([]);
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
        'gspot.toml': settingsText([]),
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
        containing({ name: 'xmllint', state: 'missing', hint }),
    );
    const checked = await checkReport(
        root,
        ['check', 'document.xml', '--only', 'files/xmllint', '--json'],
        environment,
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(checked.report.checks).toMatchObject([
        { check: 'files/xmllint', status: 'missing', findings: [], note: `xmllint is not installed. ${hint}` },
    ]);
});
