import semver from 'semver';
import executables from 'which';
import { join, basename } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { environmentBin } from '#cli/platform/contracts.ts';
import { applicableManifests } from '#cli/planning/public.ts';
import { doctorCommand } from '#cli/commands/doctor/public.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { toolPin, collectPins, toolProjectPackage } from '#cli/configurations/contracts.ts';
import { NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform/locations.ts';

test('doctor lists a tool only on the systems it has a build for', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['files', 'xcode']),
        'document.xml': '<root/>',
        'Info.plist': '<plist/>',
    });
    const result = await doctorCommand(sandbox.path);
    const names = (result.json as DoctorReport).tools.map((tool) => tool.name);
    expect(names).toContain('xmllint');
    expect(names.includes('plutil')).toBe(process.platform === 'darwin');
});

test('doctor identifies unowned generated-directory files that apply preserves', async () => {
    await using sandbox = await testdir();
    const original = '{"authored": true}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
        '.gspot/authored.json': original,
    });
    {
        using log = openOwnership(sandbox.path);
        const session = await openSession(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
    }
    const result = await doctorCommand(sandbox.path);
    expect(result.json).toMatchObject({
        suggestions: { unowned: [containing({ path: '.gspot/authored.json' })] },
    });
    expect(result.text).toContain('.gspot/authored.json');
    expect(await readFile(join(sandbox.path, '.gspot/authored.json'), 'utf8')).toBe(original);
});

test('doctor excludes private tool manifests from language detection and detects an authored Python project', async () => {
    await using sandbox = await testdir();
    const python = '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["pytest==8.4.2"]\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
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
});

test('doctor reports a new Python file after setup with the command that adds its configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'entry.sh': 'echo\n',
    });
    {
        using log = openOwnership(sandbox.path);
        const session = await openSession(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
    }
    await writeFile(join(sandbox.path, 'service.py'), 'print("hello")\n');
    const result = await doctorCommand(sandbox.path);
    const { suggestions } = result.json as DoctorReport;
    expect(suggestions.detected).toContainEqual(containing({ configuration: 'python', command: 'gspot add python' }));
});

test('doctor reports the private Python project for an applicable duplicate without claiming a mise output', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python'], { tables: '[agent_rules]\nenabled = false\n' }),
        'source.py': 'print("hello")\n',
        'mise.toml': '[tools]\nruff = "0.9.0"\nvale = "3.0.0"\n',
    });
    const result = await doctorCommand(sandbox.path);
    const { suggestions } = result.json as DoctorReport;
    expect(suggestions.duplicateMisePins).toStrictEqual([
        {
            tool: 'ruff',
            version: toolPin(configurationManifests().values(), 'ruff').version!,
            places: ['mise.toml', '.gspot/pyproject.toml'],
            command: 'delete the mise.toml line',
        },
    ]);
    expect(result.text).toContain('mise.toml and .gspot/pyproject.toml');
    expect(result.text).not.toContain('.mise/conf.d/gspot-tools.toml');
});

test.each(['ok', 'newer', 'outdated'] as const)(
    'doctor exits by the installed library state %s: an outdated tool exits 1',
    async (state) => {
        await using sandbox = await testdir();
        const pin = toolPin(configurationManifests().values(), 'eslint-plugin-zod');
        const floor = semver.parse(pin.min_version ?? pin.version!)!;
        let older = `${String(floor.major - 1)}.0.0`;
        if (floor.minor > 0) older = `${String(floor.major)}.${String(floor.minor - 1)}.0`;
        if (floor.patch > 0) older = `${String(floor.major)}.${String(floor.minor)}.${String(floor.patch - 1)}`;
        const versions = { ok: pin.version!, newer: semver.inc(pin.version!, 'minor')!, outdated: older };
        const version = versions[state];
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['zod'], { tables: '[agent_rules]\nenabled = false\n' }),
            'source.js': 'export const value = 1;\n',
        });
        const tools = collectPins(applicableManifests(await openSession(sandbox.path)));
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
                    else if (installation?.kind === 'python') folder = environmentBin(PYTHON_ENVIRONMENT_DIRECTORY);
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

test('doctor detects installed test frameworks instead of recommending a different runner', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['nestjs']);
    const dependencies = { '@nestjs/core': '11.2.3', jest: '30.2.0' };
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
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
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
});

test.each(['recommended', 'all'] as const)(
    'doctor names an absent coverage plugin at %s and omits it when all floors are zero',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['python', 'pytest'], { level, tables: '[coverage]\nlines = 80\n' }),
            'test_math.py': '',
        });
        const session = await openSession(sandbox.path);
        const tools = collectPins(applicableManifests(session));
        using _which = spyOn(executables, 'sync').mockReturnValue(join(sandbox.path, 'tool-bin', 'pytest'));
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
        expect((missing.json as DoctorReport).tools).toContainEqual(
            containing({ name: 'pytest-cov', state: 'missing' }),
        );
        expect(missing.text).toContain('pytest-cov');
        present = true;
        const available = await doctorCommand(sandbox.path);
        expect((available.json as DoctorReport).tools).toContainEqual(
            containing({ name: 'pytest-cov', state: 'host', found: '7.1.0' }),
        );
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            buildPolicy(['python', 'pytest'], {
                level,
                tables: '[coverage]\nlines = 0\nbranches = 0\nfunctions = 0\nstatements = 0\n[reasons]\n"coverage.lines" = "This fixture tests optional coverage."\n"coverage.branches" = "This fixture tests optional coverage."\n"coverage.functions" = "This fixture tests optional coverage."\n"coverage.statements" = "This fixture tests optional coverage."\n',
            }),
        );
        const zero = await doctorCommand(sandbox.path);
        expect((zero.json as DoctorReport).tools.map((tool) => tool.name)).not.toContain('pytest-cov');
    },
);
