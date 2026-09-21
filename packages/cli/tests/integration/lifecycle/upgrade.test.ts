import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync, chmodSync, existsSync, writeFileSync } from 'node:fs';
import { migratePolicy } from '#cli/lifecycle/upgrade/renames.ts';
import { upgradeCommand } from '#cli/lifecycle/upgrade/command.ts';
import { parsePolicyText } from '#cli/policy/read-policy.ts';
import { applyAll } from '#cli/emit/apply-command.ts';
import { openSession } from '#cli/run/session.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { GSPOT_VERSION, writePin } from '#cli/run/version-pin.ts';
import { run } from '#cli/platform/spawn.ts';

const options = { yes: true, install: false, isDryRun: false };

test('ordered root and scoped renames run before target validation and leave the source untouched', async () => {
    await using repository = await testdir();
    const source =
        '# Authored policy comment\nversion = 1\npresets = ["formatting"]\nold_level = "all"\n[format]\nold_width = 4\n[[scope]]\npath = "src"\n[scope.format]\nold_width = 2\n';
    await createFileTree(repository.path, { 'gspot.toml': source, 'src/entry.ts': 'export {};\n' });
    chmodSync(join(repository.path, 'gspot.toml'), 0o640);
    expect(() => parsePolicyText(source, 'gspot.toml', repository.path)).toThrow('old_level');
    const migrated = migratePolicy(repository.path, source, '1.0.0', '1.2.0', [
        { version: '1.2.0', old_key: 'intermediate_level', new_key: 'level' },
        { version: '1.1.0', old_key: 'old_level', new_key: 'intermediate_level' },
        { version: '1.1.0', old_key: 'format.old_width', new_key: 'format.indent_width' },
    ]);
    expect(migrated.policy.level).toBe('all');
    expect(migrated.text).toContain('# Authored policy comment');
    expect(migrated.text).toContain('indent_width = 4');
    expect(migrated.text).toContain('indent_width = 2');
    expect(migrated.rewrites).toContain('scope[0].format.old_width -> scope[0].format.indent_width');
    expect(migrated.text).not.toContain('old_level =');
    expect(migrated.text).not.toContain('intermediate_level =');
    expect(readFileSync(join(repository.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(statSync(join(repository.path, 'gspot.toml')).mode & 0o777).toBe(0o640);
    expect(existsSync(join(repository.path, '.gspot'))).toBe(false);
    expect(() => migratePolicy(repository.path, source, '1.0.0', '1.2.0')).toThrow('old_level');
    expect(() =>
        migratePolicy(
            repository.path,
            source.replace('[format]', 'level = "recommended"\n[format]'),
            '1.0.0',
            '1.2.0',
            [{ version: '1.1.0', old_key: 'old_level', new_key: 'level' }],
        ),
    ).toThrow('already exists');
});

test('an unsupported downgrade refuses before applying an older schema or creating ownership state', async () => {
    await using repository = await testdir();
    const source = 'version = 99\nfuture_setting = true\n';
    await createFileTree(repository.path, { 'gspot.toml': source, '.gspot/version': '99.0.0\n' });
    await expect(upgradeCommand({ cwd: repository.path, ...options })).rejects.toThrow('No reverse migration');
    expect(readFileSync(join(repository.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8')).toBe('99.0.0\n');
    expect(existsSync(join(repository.path, '.gspot/ownership.json'))).toBe(false);
});

test('an interruption before the version pin recovers generated writes and retains their original recovery bytes', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': 'version = 1\npresets = ["bash"]\n[rules]\ninstall = false\n',
        'entry.sh': 'echo example\n',
    });
    await applyAll(await openSession(repository.path));
    withLifecycleOwner(repository.path, (owner) => {
        writePin(repository.path, '0.0.1');
        owner.replace(
            '.gspot/shellcheckrc',
            { bytes: Buffer.from('older generated configuration\n'), mode: 0o444 },
            'config',
        );
    });
    const boundary = fileURLToPath(new URL('../../../src/lifecycle/confined.ts', import.meta.url));
    const command = fileURLToPath(new URL('../../../src/lifecycle/upgrade/command.ts', import.meta.url));
    const childSource = `
        import { mock } from 'bun:test';
        const boundary = await import(${JSON.stringify(boundary)});
        const open = boundary.openConfinedRoot;
        mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openConfinedRoot(root) {
            const files = open(root);
            return { ...files, write(path, value, expected) {
                if (path === '.gspot/version') process.exit(73);
                files.write(path, value, expected);
            } };
        } }));
        const { upgradeCommand } = await import(${JSON.stringify(command)});
        await upgradeCommand({ cwd: process.cwd(), yes: true, install: false, isDryRun: false });
    `;
    const interrupted = await run([process.execPath, '-e', childSource], { cwd: repository.path });
    expect(interrupted.code, interrupted.stdout + interrupted.stderr).toBe(73);
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8').trim()).toBe('0.0.1');
    expect(readFileSync(join(repository.path, '.gspot/shellcheckrc'), 'utf8')).not.toBe(
        'older generated configuration\n',
    );
    const retry = await upgradeCommand({ cwd: repository.path, ...options });
    expect(retry.exitCode, retry.text).toBe(0);
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
    const recovery = join(repository.path, '.gspot/recovery');
    expect(
        readdirSync(recovery, { recursive: true })
            .filter((path) => String(path).endsWith('.original'))
            .some((path) => readFileSync(join(recovery, String(path)), 'utf8') === 'older generated configuration\n'),
    ).toBe(true);
    expect(JSON.parse(readFileSync(join(repository.path, '.gspot/ownership.json'), 'utf8')).pending).toBeUndefined();
});

test('an edited generated output prevents the upgrade pin from advancing until the edit is resolved', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': 'version = 1\npresets = ["bash"]\n[rules]\ninstall = false\n',
        'entry.sh': 'echo example\n',
    });
    await applyAll(await openSession(repository.path));
    writePin(repository.path, '0.0.1');
    const path = join(repository.path, '.gspot/shellcheckrc');
    const generated = readFileSync(path);
    chmodSync(path, 0o644);
    writeFileSync(path, 'authored later\n');
    await expect(upgradeCommand({ cwd: repository.path, ...options })).rejects.toThrow('version pin was not changed');
    expect(readFileSync(path, 'utf8')).toBe('authored later\n');
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8').trim()).toBe('0.0.1');
    writeFileSync(path, generated);
    chmodSync(path, 0o444);
    expect((await upgradeCommand({ cwd: repository.path, ...options })).exitCode).toBe(0);
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
});

test('failed tool lock resolution leaves the previous lock, generated manifest, and version pin intact', async () => {
    await using repository = await testdir();
    const policy = 'version = 1\npresets = ["formatting"]\n[runner]\ntool = "bun"\n[rules]\ninstall = false\n';
    const manifest = '{"authored":"previous generated package bytes"}\n';
    const lock = '<<<<<<< previous lock\n';
    await createFileTree(repository.path, {
        'gspot.toml': policy,
        'package.json': '{"private":true,"packageManager":"bun@99.0.0"}',
        '.gspot/version': '0.0.1\n',
        '.gspot/package.json': manifest,
        '.gspot/bun.lock': lock,
    });
    const preview = await upgradeCommand({ cwd: repository.path, ...options, isDryRun: true });
    expect(preview.exitCode, preview.text).toBe(0);
    expect(preview.text).toContain('.gspot/bun.lock');
    expect(existsSync(join(repository.path, '.gspot/ownership.json'))).toBe(false);
    await expect(upgradeCommand({ cwd: repository.path, ...options })).rejects.toThrow(
        'Install that package manager version first',
    );
    expect(readFileSync(join(repository.path, '.gspot/bun.lock'), 'utf8')).toBe(lock);
    expect(readFileSync(join(repository.path, '.gspot/package.json'), 'utf8')).toBe(manifest);
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
});
