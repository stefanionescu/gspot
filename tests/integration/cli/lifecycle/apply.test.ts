import { applyCommand } from '#cli/commands/apply/command.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { run } from '#tests/support/cli/command.ts';
import { expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import packageManifest from '../../../../packages/cli/package.json' with { type: 'json' };

const { version: GSPOT_VERSION } = packageManifest;

test('apply rejects injected SQLFluff dialect directives with exit 2 before changing configuration', async () => {
    await using sandbox = await testdir();
    const original = '[sqlfluff]\ndialect = postgres\n';
    const policy = (dialect: string) =>
        `version = 1\nconfigurations = ["sql"]\n[tools.sqlfluff]\ndialect = ${JSON.stringify(dialect)}\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy('sqlite\nexclude_rules = ALL'),
        '.gspot/config/sqlfluff.cfg': original,
    });
    const refused = await run(sandbox.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Use a SQLFluff dialect label');
    expect(await Bun.file(join(sandbox.path, '.gspot/config/sqlfluff.cfg')).text()).toBe(original);
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy('sqlite'));
    const corrected = await run(sandbox.path, ['apply', '--dry-run']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.gspot/config/sqlfluff.cfg')).text()).toBe(original);
});

test('apply preview names a SwiftLint rule addition and leaves existing configuration unchanged', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\nlevel = "all"\nconfigurations = ["swift"]\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "empty_count"\nreason = "The fixture verifies enabling a previously ignored rule."\n`,
        'Example.swift': 'let example = 1\n',
    });
    const renderSession1 = await openSession(sandbox.path);
    const original = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    }).files.find((file) => file.path === '.gspot/config/swiftlint.yml')!;
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
    const renderSession2 = await openSession(sandbox.path);
    const corrected = emitAll(renderSession2.policyFiles.policy, renderSession2.repository, renderSession2.scopes, {
        version: renderSession2.version,
        packageManager: renderSession2.packageManager,
    }).files.find((file) => file.path === original.path)!;
    writeFileSync(join(sandbox.path, original.path), corrected.content);
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain(
        'opt_in_rules: added empty_count',
    );
});

test.each([
    { configuration: 'bash', tool: 'shellcheck', rule: 'SC2086', target: 'shellcheckrc', collection: 'disable' },
    {
        configuration: 'swift',
        tool: 'swiftformat',
        rule: 'consecutiveSpaces',
        target: 'swiftformat',
        collection: 'disable',
    },
    {
        configuration: 'sql',
        tool: 'sqlfluff',
        rule: 'CP01',
        target: 'sqlfluff.cfg',
        collection: 'sqlfluff.exclude_rules',
    },
    {
        configuration: 'postgres',
        tool: 'squawk',
        rule: 'adding-required-field',
        target: 'squawk.toml',
        collection: 'excluded_rules',
    },
    { configuration: 'nginx', tool: 'gixy', rule: 'ssrf', target: 'gixy.cfg', collection: 'skips' },
])(
    'apply preview names a removed $tool suppression without changing installed rules',
    async ({ configuration, tool, rule, target, collection }) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "all"\nconfigurations = ["${configuration}"]\n[rules]\ninstall = false\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `${policy}\n[[ignore]]\ncheck = "${configuration}/${tool}"\nrule = "${rule}"\nreason = "The fixture verifies a removed suppression."\n`,
        });
        const renderSession3 = await openSession(sandbox.path);
        const original = emitAll(renderSession3.policyFiles.policy, renderSession3.repository, renderSession3.scopes, {
            version: renderSession3.version,
            packageManager: renderSession3.packageManager,
        }).files.find((file) => file.path === `.gspot/config/${target}`)!;
        await createFileTree(sandbox.path, { [original.path]: original.content });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(preview.text).toContain(`${collection}: removed ${rule}`);
        expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
        const renderSession4 = await openSession(sandbox.path);
        const corrected = emitAll(renderSession4.policyFiles.policy, renderSession4.repository, renderSession4.scopes, {
            version: renderSession4.version,
            packageManager: renderSession4.packageManager,
        }).files.find((file) => file.path === original.path)!;
        writeFileSync(join(sandbox.path, original.path), corrected.content);
        expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain(
            `${collection}: removed ${rule}`,
        );
    },
);

test('apply preview names added Vale styles when prose moves from recommended to all', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\nconfigurations = ["prose"]\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy });
    const renderSession5 = await openSession(sandbox.path);
    const original = emitAll(renderSession5.policyFiles.policy, renderSession5.repository, renderSession5.scopes, {
        version: renderSession5.version,
        packageManager: renderSession5.packageManager,
    }).files.find((file) => file.path === '.gspot/config/vale.ini')!;
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
    const renderSession6 = await openSession(sandbox.path);
    const corrected = emitAll(renderSession6.policyFiles.policy, renderSession6.repository, renderSession6.scopes, {
        version: renderSession6.version,
        packageManager: renderSession6.packageManager,
    }).files.find((file) => file.path === original.path)!;
    writeFileSync(join(sandbox.path, original.path), corrected.content);
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain('*.BasedOnStyles: added');
});

test.each([
    { configuration: 'commits', check: 'commitlint', rule: 'type-case', target: 'commitlint.config.cjs' },
    { configuration: 'configs', check: 'yaml', rule: 'truthy', target: 'yamllint.yml' },
    { configuration: 'html', check: 'html-validate', rule: 'no-inline-style', target: 'html-validate-templates.json' },
])(
    'apply preview names an enabled $check rule and preserves installed configuration',
    async ({ configuration, check, rule, target }) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "all"\nconfigurations = ["${configuration}"]\n[rules]\ninstall = false\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `${policy}\n[[ignore]]\ncheck = "${configuration}/${check}"\nrule = "${rule}"\nreason = "The fixture verifies enabling a previously disabled rule."\n`,
        });
        const renderSession7 = await openSession(sandbox.path);
        const original = emitAll(renderSession7.policyFiles.policy, renderSession7.repository, renderSession7.scopes, {
            version: renderSession7.version,
            packageManager: renderSession7.packageManager,
        }).files.find((file) => file.path === `.gspot/config/${target}`)!;
        await createFileTree(sandbox.path, { [original.path]: original.content });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(preview.text).toContain(`rules: changed ${rule}`);
        expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
        const renderSession8 = await openSession(sandbox.path);
        const corrected = emitAll(renderSession8.policyFiles.policy, renderSession8.repository, renderSession8.scopes, {
            version: renderSession8.version,
            packageManager: renderSession8.packageManager,
        }).files.find((file) => file.path === original.path)!;
        writeFileSync(join(sandbox.path, original.path), corrected.content);
        expect((await applyCommand({ cwd: sandbox.path, isDryRun: true })).text).not.toContain(
            `rules: changed ${rule}`,
        );
    },
);

test('apply preview names a missing Semgrep rule by ID and clears it after correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["security"]\n[rules]\ninstall = false\n',
    });
    const renderSession9 = await openSession(sandbox.path);
    const original = emitAll(renderSession9.policyFiles.policy, renderSession9.repository, renderSession9.scopes, {
        version: renderSession9.version,
        packageManager: renderSession9.packageManager,
    }).files.find((file) => file.path === '.gspot/config/semgrep/node.yml')!;
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
    const policy = 'version = 1\nconfigurations = []\n[rules]\ninstall = true\n';
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
    await createFileTree(repository.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        '.gspot/version': '0.0.1\n',
    });
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
        'project/gspot.toml': 'version = 1\nconfigurations = ["spelling"]\n',
        'project/.gspot/config/.keep': '',
        outside: 'authored external configuration\n',
    });
    const project = join(sandbox.path, 'project');
    fs.symlinkSync(join(sandbox.path, 'outside'), join(project, '.gspot/config/typos.toml'));
    await expect(applyCommand({ cwd: project, isDryRun: true })).rejects.toThrow('private regular file');
    expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe('authored external configuration\n');
    expect(fs.existsSync(join(project, '.gspot/state/ownership.json'))).toBe(false);
    expect(fs.existsSync(join(project, '.gspot/version'))).toBe(false);
});

test.each(['gspot.toml', '.gspot/version'])(
    'apply preview rejects an external %s before producing configuration',
    async (path) => {
        await using sandbox = await testdir();
        const policy = 'version = 1\nconfigurations = []\n';
        const original = path === 'gspot.toml' ? policy : '0.0.1\n';
        await createFileTree(sandbox.path, {
            'project/gspot.toml': policy,
            'project/.gspot/config/.keep': '',
            outside: original,
        });
        const project = join(sandbox.path, 'project');
        if (path === 'gspot.toml') fs.unlinkSync(join(project, path));
        fs.symlinkSync(join(sandbox.path, 'outside'), join(project, path));
        await expect(applyCommand({ cwd: project, isDryRun: true })).rejects.toThrow('private regular file');
        expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe(original);
        expect(fs.existsSync(join(project, '.gspot/state/ownership.json'))).toBe(false);
    },
);

test('apply validates obsolete output parents before publishing new configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n',
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
