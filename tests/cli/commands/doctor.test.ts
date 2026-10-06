import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as inspect from '#cli/tools/inspect.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { doctorCommand } from '#cli/commands/doctor/command.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

test('doctor lists a tool only on the systems it has a build for', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['files']),
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
        writeOutputs(await openSession(sandbox.path), log);
    }
    const result = await doctorCommand(sandbox.path);
    expect(result.json).toMatchObject({
        suggestions: { unowned: [containing({ path: '.gspot/authored.json' })] },
    });
    expect(result.text).toContain('.gspot/authored.json');
    expect(readFileSync(join(sandbox.path, '.gspot/authored.json'), 'utf8')).toBe(original);
});

test('doctor fails hooks this clone does not run and accepts them once installed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([], { tables: '[hooks]\n' }) });
    expect(runBlocking(['git', 'init', '-q'], { cwd: sandbox.path }).code).toBe(0);
    const missing = await doctorCommand(sandbox.path);
    expect(missing.exitCode).toBe(1);
    expect(missing.text).toContain('not installed; run gspot install');
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await runGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const diagnosed = await doctorCommand(sandbox.path);
    expect(diagnosed.exitCode, diagnosed.text).toBe(0);
    expect(diagnosed.text).toContain('.gspot/hooks: installed');
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
    writeFileSync(join(sandbox.path, 'pyproject.toml'), python);
    const authored = await doctorCommand(sandbox.path);
    expect(authored.json).toMatchObject({
        suggestions: {
            detected: containingAll([containing({ configuration: 'python', evidence: 'pyproject.toml' })]),
        },
    });
    expect(readFileSync(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(python);
});

test('doctor reports a new Python file after setup with the command that adds its configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'entry.sh': 'echo\n',
    });
    {
        using log = openOwnership(sandbox.path);
        writeOutputs(await openSession(sandbox.path), log);
    }
    writeFileSync(join(sandbox.path, 'service.py'), 'print("hello")\n');
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
            version: '0.16.8',
            places: ['mise.toml', '.gspot/pyproject.toml'],
            command: 'delete the mise.toml line',
        },
    ]);
    expect(result.text).toContain('mise.toml and .gspot/pyproject.toml');
    expect(result.text).not.toContain('.mise/conf.d/gspot-tools.toml');
});

test.each([
    ['4.12.0', 0],
    ['4.0.0', 1],
])('doctor exits by the installed library version %s: an outdated tool exits 1', async (version, code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['zod'], { tables: '[agent_rules]\nenabled = false\n' }),
        'source.js': 'export const value = 1;\n',
        '.gspot/node_modules/eslint-plugin-zod/package.json': JSON.stringify({ name: 'eslint-plugin-zod', version }),
    });
    const original = inspect.inspectTool;
    // Every other tool reads as ready, so the exit code follows the one test library alone.
    using inspected = spyOn(inspect, 'inspectTool').mockImplementation((context, tool) =>
        tool.name === 'eslint-plugin-zod' ? original(context, tool) : { name: tool.name, state: 'ok' },
    );
    const result = await doctorCommand(sandbox.path);
    expect(inspected).toHaveBeenCalled();
    const report = result.json as DoctorReport;
    expect(report.tools.find((tool) => tool.name === 'eslint-plugin-zod')?.state).toBe(code === 0 ? 'ok' : 'outdated');
    expect(result.exitCode).toBe(code);
});

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
    expect(current.suggestions.recommended.map((row) => row.configuration)).not.toContain('vitest');
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
