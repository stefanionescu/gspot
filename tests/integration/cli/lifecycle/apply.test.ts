import { applyCommand } from '#cli/emit/apply-command.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { openSession } from '#cli/run/session.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { run } from '#tests/support/cli/command.ts';
import { expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test('apply rejects injected SQLFluff dialect directives with exit 2 before changing configuration', async () => {
    await using sandbox = await testdir();
    const original = '[sqlfluff]\ndialect = postgres\n';
    const policy = (dialect: string) =>
        `version = 1\npresets = ["sql"]\n[tools.sqlfluff]\ndialect = ${JSON.stringify(dialect)}\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy('sqlite\nexclude_rules = ALL'),
        '.gspot/sqlfluff.cfg': original,
    });
    const refused = await run(sandbox.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Use a SQLFluff dialect label');
    expect(await Bun.file(join(sandbox.path, '.gspot/sqlfluff.cfg')).text()).toBe(original);
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy('sqlite'));
    const corrected = await run(sandbox.path, ['apply', '--dry-run']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.gspot/sqlfluff.cfg')).text()).toBe(original);
});

test('apply preview names a SwiftLint rule addition and leaves existing configuration unchanged', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\nlevel = "all"\npresets = ["swift"]\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "empty_count"\nreason = "The fixture verifies enabling a previously ignored rule."\n`,
        'Example.swift': 'let example = 1\n',
    });
    const original = emitAll(await openSession(sandbox.path)).files.find(
        (file) => file.path === '.gspot/swiftlint.yml',
    )!;
    await createFileTree(sandbox.path, { [original.path]: original.content });
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.text).toContain('opt_in_rules: added empty_count');
    expect(preview.json).toMatchObject({
        drift: expect.arrayContaining([
            expect.objectContaining({
                path: original.path,
                rules: expect.arrayContaining([
                    { path: 'opt_in_rules', added: ['empty_count'], removed: [], changed: [] },
                    { path: 'disabled_rules', added: [], removed: ['empty_count'], changed: [] },
                ]),
            }),
        ]),
    });
    expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
    const corrected = emitAll(await openSession(sandbox.path)).files.find((file) => file.path === original.path)!;
    writeFileSync(join(sandbox.path, original.path), corrected.content);
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain(
        'opt_in_rules: added empty_count',
    );
});

test.each([
    { preset: 'bash', tool: 'shellcheck', rule: 'SC2086', target: 'shellcheckrc', collection: 'disable' },
    { preset: 'swift', tool: 'swiftformat', rule: 'consecutiveSpaces', target: 'swiftformat', collection: 'disable' },
    { preset: 'sql', tool: 'sqlfluff', rule: 'CP01', target: 'sqlfluff.cfg', collection: 'sqlfluff.exclude_rules' },
    {
        preset: 'postgres',
        tool: 'squawk',
        rule: 'adding-required-field',
        target: 'squawk.toml',
        collection: 'excluded_rules',
    },
    { preset: 'nginx', tool: 'gixy', rule: 'ssrf', target: 'gixy.cfg', collection: 'skips' },
])(
    'apply preview names a removed $tool suppression without changing installed rules',
    async ({ preset, tool, rule, target, collection }) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "all"\npresets = ["${preset}"]\n[rules]\ninstall = false\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `${policy}\n[[ignore]]\ncheck = "${preset}/${tool}"\nrule = "${rule}"\nreason = "The fixture verifies a removed suppression."\n`,
        });
        const original = emitAll(await openSession(sandbox.path)).files.find(
            (file) => file.path === `.gspot/${target}`,
        )!;
        await createFileTree(sandbox.path, { [original.path]: original.content });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(preview.text).toContain(`${collection}: removed ${rule}`);
        expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
        const corrected = emitAll(await openSession(sandbox.path)).files.find((file) => file.path === original.path)!;
        writeFileSync(join(sandbox.path, original.path), corrected.content);
        expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain(
            `${collection}: removed ${rule}`,
        );
    },
);

test('apply preview names added Vale styles when prose moves from recommended to all', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\npresets = ["prose"]\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy });
    const original = emitAll(await openSession(sandbox.path)).files.find((file) => file.path === '.gspot/vale.ini')!;
    await createFileTree(sandbox.path, { [original.path]: original.content });
    writeFileSync(join(sandbox.path, 'gspot.toml'), `level = "all"\n${policy}`);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.json).toMatchObject({
        drift: expect.arrayContaining([
            expect.objectContaining({
                path: original.path,
                rules: expect.arrayContaining([
                    expect.objectContaining({
                        path: '*.BasedOnStyles',
                        added: expect.arrayContaining(['Google', 'Microsoft']),
                    }),
                ]),
            }),
        ]),
    });
    expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
    const corrected = emitAll(await openSession(sandbox.path)).files.find((file) => file.path === original.path)!;
    writeFileSync(join(sandbox.path, original.path), corrected.content);
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain('*.BasedOnStyles: added');
});

test.each([
    { preset: 'commits', check: 'commitlint', rule: 'type-case', target: 'commitlint.config.cjs' },
    { preset: 'configs', check: 'yaml', rule: 'truthy', target: 'yamllint.yml' },
    { preset: 'html', check: 'html-validate', rule: 'no-inline-style', target: 'html-validate-templates.json' },
])(
    'apply preview names an enabled $check rule and preserves installed configuration',
    async ({ preset, check, rule, target }) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "all"\npresets = ["${preset}"]\n[rules]\ninstall = false\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `${policy}\n[[ignore]]\ncheck = "${preset}/${check}"\nrule = "${rule}"\nreason = "The fixture verifies enabling a previously disabled rule."\n`,
        });
        const original = emitAll(await openSession(sandbox.path)).files.find(
            (file) => file.path === `.gspot/${target}`,
        )!;
        await createFileTree(sandbox.path, { [original.path]: original.content });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(preview.text).toContain(`rules: changed ${rule}`);
        expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
        const corrected = emitAll(await openSession(sandbox.path)).files.find((file) => file.path === original.path)!;
        writeFileSync(join(sandbox.path, original.path), corrected.content);
        expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain(
            `rules: changed ${rule}`,
        );
    },
);

test('apply preview names a missing Semgrep rule by ID and clears it after correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\npresets = ["security"]\n[rules]\ninstall = false\n',
    });
    const original = emitAll(await openSession(sandbox.path)).files.find(
        (file) => file.path === '.gspot/semgrep/node.yml',
    )!;
    const parsed = Bun.YAML.parse(original.content) as { rules: { id: string }[] };
    const removed = parsed.rules.shift()!;
    const before = Bun.YAML.stringify(parsed);
    await createFileTree(sandbox.path, { [original.path]: before });
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.text).toContain(`rules: added ${removed.id}`);
    expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(before);
    writeFileSync(join(sandbox.path, original.path), original.content);
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain(
        `rules: added ${removed.id}`,
    );
});

test('apply previews changed pins, preserves policy, and writes the pin only after successful generation', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\npresets = []\n[rules]\ninstall = true\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy, '.gspot/version': '0.0.1\n' });
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.json).toMatchObject({ isDryRun: true, pin: { from: '0.0.1', to: GSPOT_VERSION } });
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    const output = (applied.json as { written: string[] }).written.find((path) => path !== '.gspot/version')!;
    expect(output).toBeDefined();
    chmodSync(join(sandbox.path, output), 0o644);
    writeFileSync(join(sandbox.path, output), 'authored edit');
    writeFileSync(join(sandbox.path, '.gspot/version'), '0.0.1\n');
    await expect(applyCommand({ cwd: sandbox.path, isDryRun: false })).rejects.toThrow('version pin was not changed');
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    expect(readFileSync(join(sandbox.path, output), 'utf8')).toBe('authored edit');
});

test('a failed pin publication leaves the old version and succeeds after the write failure is repaired', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, { 'gspot.toml': 'version = 1\npresets = []\n', '.gspot/version': '0.0.1\n' });
    const rename = fs.renameSync;
    const failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(repository.path, '.gspot/version')) throw new Error('Pin write denied');
        rename(source, target);
    });
    try {
        await expect(applyCommand({ cwd: repository.path, isDryRun: false })).rejects.toThrow('Pin write denied');
        expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    } finally {
        failed.mockRestore();
    }
    expect((await applyCommand({ cwd: repository.path, isDryRun: false })).exitCode).toBe(0);
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
});

test('apply preview rejects a generated destination linked outside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/gspot.toml': 'version = 1\npresets = ["spelling"]\n',
        'project/.gspot/.keep': '',
        outside: 'authored external configuration\n',
    });
    const project = join(sandbox.path, 'project');
    fs.symlinkSync(join(sandbox.path, 'outside'), join(project, '.gspot/typos.toml'));
    await expect(applyCommand({ cwd: project, isDryRun: true })).rejects.toThrow('private regular file');
    expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe('authored external configuration\n');
    expect(fs.existsSync(join(project, '.gspot/ownership.json'))).toBe(false);
    expect(fs.existsSync(join(project, '.gspot/version'))).toBe(false);
});

test.each(['gspot.toml', '.gspot/version'])(
    'apply preview rejects an external %s before producing configuration',
    async (path) => {
        await using sandbox = await testdir();
        const policy = 'version = 1\npresets = []\n';
        const original = path === 'gspot.toml' ? policy : '0.0.1\n';
        await createFileTree(sandbox.path, {
            'project/gspot.toml': policy,
            'project/.gspot/.keep': '',
            outside: original,
        });
        const project = join(sandbox.path, 'project');
        if (path === 'gspot.toml') fs.unlinkSync(join(project, path));
        fs.symlinkSync(join(sandbox.path, 'outside'), join(project, path));
        await expect(applyCommand({ cwd: project, isDryRun: true })).rejects.toThrow('private regular file');
        expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe(original);
        expect(fs.existsSync(join(project, '.gspot/ownership.json'))).toBe(false);
    },
);

test('apply validates obsolete output parents before publishing new configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': 'version = 1\npresets = []\n[rules]\ninstall = false\n',
        'outside/old.txt': 'outside bytes\n',
    });
    const root = join(directory.path, 'project');
    const owner = openLifecycleOwner(root);
    try {
        owner.replace('.gspot/obsolete/old.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config');
    } finally {
        owner.close();
    }
    fs.rmSync(join(root, '.gspot/obsolete'), { recursive: true });
    fs.symlinkSync('../../outside', join(root, '.gspot/obsolete'));
    await expect(applyCommand({ cwd: root, isDryRun: false })).rejects.toThrow('Unsafe lifecycle parent');
    expect(fs.existsSync(join(root, '.gitattributes'))).toBe(false);
    expect(fs.existsSync(join(root, '.gspot/version'))).toBe(false);
    expect(readFileSync(join(directory.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
    fs.unlinkSync(join(root, '.gspot/obsolete'));
    await createFileTree(root, { '.gspot/obsolete/old.txt': 'installed\n' });
    expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
    expect(fs.existsSync(join(root, '.gspot/obsolete/old.txt'))).toBe(false);
    expect(fs.existsSync(join(root, '.gitattributes'))).toBe(true);
    expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
});
