// Bun template fixtures verify publication, recovery, and preservation through the real lifecycle.
import * as fs from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { setKey } from '#cli/policy/edit.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { exportCommand } from '#cli/commands/export.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { readTree } from '#tests/harness/preservation.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { getTemplate, exportTemplate } from '#cli/policy/templates.ts';
import { statSync, chmodSync, symlinkSync, readFileSync } from 'node:fs';
import { writePolicy, preparePolicy } from '#cli/commands/policy-edit.ts';
import { getOwnership, openOwnership } from '#cli/lifecycle/ownership/log.ts';

describe('template file paths', () => {
    test('an absolute template loads from a different working directory', async () => {
        const source = 'policies/café house.template.toml';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [source]: 'template = "house"\nselection = "exact"\nconfigurations = ["bash"]\n',
            'project/README.md': '# Project\n',
        });
        const relative = await getTemplate(source, sandbox.path);
        const absolute = await getTemplate(join(sandbox.path, source), join(sandbox.path, 'project'));
        expect(absolute.tables).toStrictEqual(relative.tables);
        expect(absolute.digest).toBe(relative.digest);
    });
});

test('templates retain runner coverage settings and omit the architecture roles, which name repository paths', async () => {
    await using directory = await testdir();
    const tools = { jest: { coverage: { lines: 90 }, globals_module: 'bun:test' } };
    const roles = { harness: 'tests/fixtures' };
    const exported = exportTemplate(
        stringify({ configurations: ['jest'], tools, architecture: { roles } }),
        'shared.template.toml',
    );
    await createFileTree(directory.path, { 'shared.template.toml': exported.text });
    const restored = await getTemplate('shared.template.toml', directory.path);
    expect(restored.tables.tools?.['jest']).toStrictEqual(tools.jest);
    expect(exported.leftOut).toStrictEqual(['architecture.roles: names a repository path']);
    await createFileTree(directory.path, {
        'invalid.template.toml': stringify({
            template: 'local',
            selection: 'exact',
            configurations: ['jest'],
            architecture: { roles },
        }),
    });
    expect(await rejection(getTemplate('invalid.template.toml', directory.path))).toContain(
        'a template carries no path',
    );
});

test('template publication is idempotent, preserves edits, and survives apply', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
    });
    expect(exportCommand(directory.path, 'shared.template.toml').exitCode).toBe(0);
    const path = join(directory.path, 'shared.template.toml');
    const first = readFileSync(path);
    expect(exportCommand(directory.path, 'shared.template.toml').exitCode).toBe(0);
    expect(readFileSync(path)).toStrictEqual(first);
    const applied = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(path)).toStrictEqual(first);
    await Bun.write(path, `${first.toString('utf8')}\n# Authored note.\n`);
    expect(() => exportCommand(directory.path, 'shared.template.toml')).toThrow(
        'The file shared.template.toml was not overwritten by gspot. Move it aside, then retry the command.',
    );
    expect(readFileSync(path, 'utf8')).toContain('# Authored note.');
});

test('template export resolves a parent destination inside the repository from a nested working directory', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' });
    await createFileTree(directory.path, { 'gspot.toml': policy, 'app/entry.sh': 'echo example\n' });
    const exported = exportCommand(join(directory.path, 'app'), '../team.template.toml');
    expect(exported.exitCode).toBe(0);
    expect(exported.json).toStrictEqual({ file: '../team.template.toml', leftOut: [] });
    const restored = await getTemplate('team.template.toml', directory.path);
    expect(restored.tables.configurations).toStrictEqual(['bash']);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(readFileSync(join(directory.path, 'app/entry.sh'), 'utf8')).toBe('echo example\n');
});

test.each([
    '../outside.toml',
    '/outside.toml',
    'C:outside.toml',
    String.raw`C:\outside.toml`,
    'linked/template.toml',
    'linked.toml',
])('template export refuses unsafe destination %s without changing external bytes', async (file) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': buildPolicy([]),
        'outside/template.toml': 'original',
    });
    const root = join(directory.path, 'project');
    const outside = join(directory.path, 'outside/template.toml');
    symlinkSync('../outside', join(root, 'linked'), 'dir');
    symlinkSync(outside, join(root, 'linked.toml'));
    expect(() => exportCommand(root, file)).toThrow(Error);
    expect(readFileSync(outside, 'utf8')).toBe('original');
});

test('template export preserves an unowned destination and refuses the managed repository policy', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
        'occupied.toml': 'original bytes',
    });
    const occupied = join(directory.path, 'occupied.toml');
    chmodSync(occupied, 0o444);
    expect(() => exportCommand(directory.path, 'occupied.toml')).toThrow(/occupied\.toml.*not overwritten/u);
    expect(readFileSync(occupied, 'utf8')).toBe('original bytes');
    expect(statSync(occupied).mode & 0o200).toBe(0);
    // Commit a real policy edit so this refusal exercises a managed policy destination.
    const plan = preparePolicy(directory.path, (raw) => {
        setKey(raw, 'require_reasons', true);
    });
    {
        using log = openOwnership(directory.path);
        writePolicy(log, plan);
    }
    const original = readFileSync(join(directory.path, 'gspot.toml'));
    expect(() => exportCommand(directory.path, 'gspot.toml')).toThrow(
        'Template export cannot replace managed gspot.toml. Choose another destination.',
    );
    expect(readFileSync(join(directory.path, 'gspot.toml'))).toStrictEqual(original);
});

test('export refuses the managed policy with the same policy diagnostic in human and JSON output', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
        'control.txt': 'preserve this source\n',
    });
    const edited = await runGspot(directory.path, ['set', 'require_reasons', 'true']);
    expect(edited.code, edited.stdout + edited.stderr).toBe(0);
    const before = readTree(directory.path);
    const human = await runGspot(directory.path, ['export', 'gspot.toml']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Template export cannot replace managed gspot.toml. Choose another destination.\n');
    expect(readTree(directory.path)).toStrictEqual(before);
    const structured = await runGspot(directory.path, ['export', 'gspot.toml', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'policy',
        message: 'Template export cannot replace managed gspot.toml. Choose another destination.',
    });
    expect(readTree(directory.path)).toStrictEqual(before);
});

test('template publication recovers an interrupted write through the lifecycle log', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'gspot.toml': buildPolicy([]) });
    const path = join(directory.path, 'shared.template.toml');
    const rename = fs.renameSync;
    const failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === path) throw new Error('Template publication interrupted');
        rename(source, target);
    });
    try {
        expect(() => exportCommand(directory.path, 'shared.template.toml')).toThrow('Template publication interrupted');
        expect(await Bun.file(path).exists()).toBe(false);
        expect(getOwnership(directory.path).pending?.map((entry) => entry.path)).toStrictEqual([
            'shared.template.toml',
        ]);
    } finally {
        failed.mockRestore();
    }
    expect(exportCommand(directory.path, 'shared.template.toml').exitCode).toBe(0);
    expect(getOwnership(directory.path).pending).toBeUndefined();
    const reread = await getTemplate('shared.template.toml', directory.path);
    expect(reread.tables.configurations).toStrictEqual([]);
});

test('template publication preserves permissions when adopting identical existing bytes', async () => {
    await using directory = await testdir();
    const policy = buildPolicy([]);
    const template = exportTemplate(policy, 'shared.template.toml');
    await createFileTree(directory.path, { 'gspot.toml': policy, 'shared.template.toml': template.text });
    const path = join(directory.path, 'shared.template.toml');
    chmodSync(path, 0o444);
    expect(exportCommand(directory.path, 'shared.template.toml').exitCode).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(template.text);
    expect(statSync(path).mode & 0o200).toBe(0);
});

test('templates round-trip license allowances and exact-version exceptions', async () => {
    await using directory = await testdir();
    const licenses = {
        allowed: ['MPL-2.0'],
        exceptions: [{ package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed package metadata.' }],
    };
    const exported = exportTemplate(stringify({ configurations: ['licenses'], licenses }), 'licenses.template.toml');
    await createFileTree(directory.path, { 'licenses.template.toml': exported.text });
    const restored = await getTemplate('licenses.template.toml', directory.path);
    expect(restored.tables.licenses).toStrictEqual(licenses);
    expect(exported.leftOut).toStrictEqual([]);
});
