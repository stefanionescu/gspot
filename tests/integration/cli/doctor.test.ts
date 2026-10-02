import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { installHooks } from '#cli/lifecycle/hooks-path.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { doctorCommand } from '#cli/commands/doctor/command.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';

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
        'gspot.toml': policyOf([], '[guides]\ninstall = false\n'),
        '.gspot/authored.json': original,
    });
    await writeOutputs(await openSession(sandbox.path));
    const result = await doctorCommand({ cwd: sandbox.path });
    expect(result.json).toMatchObject({
        changes: { configurationNotOwned: [containing({ path: '.gspot/authored.json' })] },
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
        'gspot.toml': policyOf([], '[guides]\ninstall = false\n'),
        '.gspot/pyproject.toml': python,
        'nested/.gspot/package.json': '{"dependencies":{"react":"19.1.1"}}',
    });
    const privateOnly = await doctorCommand({ cwd: sandbox.path });
    expect(privateOnly.json).toMatchObject({ changes: { detectedNotSelected: [] } });
    writeFileSync(join(sandbox.path, 'pyproject.toml'), python);
    const authored = await doctorCommand({ cwd: sandbox.path });
    expect(authored.json).toMatchObject({
        changes: {
            detectedNotSelected: containingAll([containing({ kit: 'python', evidence: 'pyproject.toml' })]),
        },
    });
    expect(readFileSync(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(python);
});
