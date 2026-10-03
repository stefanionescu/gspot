import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as inspect from '#cli/tools/inspect.ts';
import { testdir, createFileTree } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { installHooks } from '#cli/lifecycle/hooks-path.ts';
import { doctorCommand } from '#cli/commands/doctor/command.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

test('doctor lists a tool only on the systems it has a build for', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf(['files']) });
    const result = await doctorCommand({ cwd: sandbox.path });
    const names = (result.json as { tools: { name: string }[] }).tools.map((tool) => tool.name);
    expect(names).toContain('xmllint');
    expect(names.includes('plutil')).toBe(process.platform === 'darwin');
});

test('doctor identifies unowned generated-directory files that apply preserves', async () => {
    await using sandbox = await testdir();
    const original = '{"authored": true}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], '[rules]\ninstall = false\n'),
        '.gspot/authored.json': original,
    });
    await writeOutputs(await openSession(sandbox.path));
    const result = await doctorCommand({ cwd: sandbox.path });
    expect(result.json).toMatchObject({
        changes: { unowned: [containing({ path: '.gspot/authored.json' })] },
    });
    expect(result.text).toContain('not recorded as owned');
    expect(readFileSync(join(sandbox.path, '.gspot/authored.json'), 'utf8')).toBe(original);
});

test('doctor fails hooks this clone does not run and accepts them once installed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([], '[hooks]\n') });
    expect(runBlocking(['git', 'init', '-q'], { cwd: sandbox.path }).code).toBe(0);
    const missing = await doctorCommand({ cwd: sandbox.path });
    expect(missing.exitCode).toBe(1);
    expect(missing.text).toContain('not installed; run gspot install');
    const session = await openSession(sandbox.path);
    installHooks({ policy: session.policyFiles.policy, repository: session.repository });
    const diagnosed = await doctorCommand({ cwd: sandbox.path });
    expect(diagnosed.exitCode, diagnosed.text).toBe(0);
    expect(diagnosed.text).toContain('.gspot/hooks: installed');
});

test('doctor excludes private tool manifests from language detection and detects an authored Python project', async () => {
    await using sandbox = await testdir();
    const python = '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["pytest==8.4.2"]\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], '[rules]\ninstall = false\n'),
        '.gspot/pyproject.toml': python,
        'nested/.gspot/package.json': '{"dependencies":{"react":"19.1.1"}}',
    });
    const privateOnly = await doctorCommand({ cwd: sandbox.path });
    expect(privateOnly.json).toMatchObject({ changes: { detected: [] } });
    writeFileSync(join(sandbox.path, 'pyproject.toml'), python);
    const authored = await doctorCommand({ cwd: sandbox.path });
    expect(authored.json).toMatchObject({
        changes: {
            detected: containingAll([containing({ kit: 'python', evidence: 'pyproject.toml' })]),
        },
    });
    expect(readFileSync(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(python);
});

test('doctor reports a new Python file after setup with the command that adds its kit', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['bash'], '[rules]\ninstall = false\n'),
        'entry.sh': 'echo\n',
    });
    await writeOutputs(await openSession(sandbox.path));
    writeFileSync(join(sandbox.path, 'service.py'), 'print("hello")\n');
    const result = await doctorCommand({ cwd: sandbox.path });
    const { changes } = result.json as DoctorReport;
    expect(changes.detected).toContainEqual(containing({ kit: 'python', command: 'gspot add python' }));
});

test.each([
    ['4.12.0', 0],
    ['4.0.0', 1],
])('doctor exits by the installed library version %s: an outdated tool exits 1', async (version, code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['zod'], '[rules]\ninstall = false\n'),
        '.gspot/node_modules/eslint-plugin-zod/package.json': JSON.stringify({ name: 'eslint-plugin-zod', version }),
    });
    const original = inspect.inspectTool;
    // Every other tool reads as ready, so the exit code follows the one planted library alone.
    using inspected = spyOn(inspect, 'inspectTool').mockImplementation((context, tool) =>
        tool.name === 'eslint-plugin-zod' ? original(context, tool) : { name: tool.name, state: 'ok' },
    );
    const result = await doctorCommand({ cwd: sandbox.path });
    expect(inspected).toHaveBeenCalled();
    const report = result.json as DoctorReport;
    expect(report.tools.find((tool) => tool.name === 'eslint-plugin-zod')?.state).toBe(code === 0 ? 'ok' : 'outdated');
    expect(result.exitCode).toBe(code);
});
