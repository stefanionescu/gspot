import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { coverageReport } from '#cli/execution/coverage.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { doctorCommand } from '#cli/commands/doctor/command.ts';
import { installHooks, uninstallHooks } from '#cli/lifecycle/hooks.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';

test('doctor coverage honors path exceptions and does not borrow syntax from another shell dialect', async () => {
    await using sandbox = await testdir();
    const policy = policyOf(['bash'], '', 'all');
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "bash/syntax"\npaths = ["source.sh"]\nreason = "The fixture exercises a path exception."\n`,
        'source.sh': 'echo example\n',
        'sibling.sh': 'echo sibling\n',
    });
    const ignored = coverageReport(await openSession(sandbox.path));
    expect(ignored.partial.find((entry) => entry.path === 'source.sh')?.missing).toContain('syntax');
    expect(ignored.partial.find((entry) => entry.path === 'sibling.sh')?.missing ?? []).not.toContain('syntax');
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const corrected = coverageReport(await openSession(sandbox.path));
    expect(corrected.partial.find((entry) => entry.path === 'source.sh')?.missing ?? []).not.toContain('syntax');
});

test('doctor coverage excludes binary files and counts routine formatting at both levels', async () => {
    await using sandbox = await testdir();
    const policy = policyOf(['bash'], '', 'recommended');
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'source.sh': 'echo example\n',
        'icon.png': Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    const recommended = coverageReport(await openSession(sandbox.path));
    expect(recommended.unchecked.map((entry) => entry.path)).not.toContain('icon.png');
    expect(recommended.partial.find((entry) => entry.path === 'source.sh')?.missing ?? []).not.toContain('format');
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('recommended', 'all'));
    const all = coverageReport(await openSession(sandbox.path));
    expect(all.partial.find((entry) => entry.path === 'source.sh')?.missing ?? []).not.toContain('format');
});

test('doctor coverage applies nested exceptions only to their owning scope', async () => {
    await using sandbox = await testdir();
    const policy = policyOf(['bash'], '', 'all');
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[scope]]\npath = "app"\nkits = []\n[[ignore]]\ncheck = "bash/syntax"\npaths = ["app"]\nreason = "The nested fixture exercises a check exception."\n`,
        'source.sh': 'echo root\n',
        'app/source.sh': 'echo nested\n',
    });
    const ignored = coverageReport(await openSession(sandbox.path));
    expect(ignored.partial.find((entry) => entry.path === 'app/source.sh')?.missing).toContain('syntax');
    expect(ignored.partial.find((entry) => entry.path === 'source.sh')?.missing ?? []).not.toContain('syntax');
    writeFileSync(join(sandbox.path, 'gspot.toml'), `${policy}\n[[scope]]\npath = "app"\nkits = []\n`);
    const corrected = coverageReport(await openSession(sandbox.path));
    expect(corrected.partial.find((entry) => entry.path === 'app/source.sh')?.missing ?? []).not.toContain('syntax');
});

test('doctor recognizes enabled repository checks across nested scopes', async () => {
    await using sandbox = await testdir();
    const policy = `version = 1
kits = []
[[scope]]
path = "app"
kits = []
[[check]]
name = "project/syntax"
command = ["bash", "-n", "{files}"]
paths = ["**/*.sh"]
stage = "commit"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "project/syntax"\nreason = "The fixture verifies disabled coverage."\n`,
        'app/source.sh': 'echo nested\n',
    });
    const ignored = coverageReport(await openSession(sandbox.path));
    expect(ignored.unchecked.map((entry) => entry.path)).toContain('app/source.sh');
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const corrected = coverageReport(await openSession(sandbox.path));
    expect(corrected.unchecked.map((entry) => entry.path)).not.toContain('app/source.sh');
    expect(corrected.checked).toBeGreaterThan(ignored.checked);
});

test('doctor reports local configuration and version', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([]),
        'README.md': '# Example\n',
    });
    const result = await doctorCommand({ cwd: sandbox.path });
    expect(result.exitCode).toBe(0);
    expect(result.json).toMatchObject({ version: { running: expect.any(String) as unknown } });
});

test('doctor identifies unowned generated-directory files that apply and uninstall preserve', async () => {
    await using sandbox = await testdir();
    const original = '{"authored": true}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], '[guides]\ninstall = false\n'),
        '.gspot/authored.json': original,
    });
    await applyAll(await openSession(sandbox.path));
    const result = await doctorCommand({ cwd: sandbox.path });
    expect(result.json).toMatchObject({
        changes: { configurationNotOwned: [containing({ path: '.gspot/authored.json' })] },
    });
    expect(result.text).toContain('not recorded as owned');
    expect(readFileSync(join(sandbox.path, '.gspot/authored.json'), 'utf8')).toBe(original);
    await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
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
    uninstallHooks(sandbox.path);
    const removed = await doctorCommand({ cwd: sandbox.path });
    expect(removed.exitCode).toBe(1);
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
