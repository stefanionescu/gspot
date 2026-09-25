import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { ownershipSchema } from '#cli/lifecycle/journal.ts';
import { applyBlock } from '#cli/lifecycle/managed-blocks.ts';
import { run, runProcess as spawn } from '#tests/support/cli/command.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'bash',
    '--no-runner',
    '--no-hooks',
    '--no-ci',
    '--no-rules',
    '--no-install',
];

test('initialization and cold and warm staged checks stay within the 5000-file performance limits', async () => {
    await using directory = await testdir();
    const sources = Object.fromEntries(
        Array.from({ length: 5000 }, (_, index) => [`scripts/task-${String(index)}.sh`, script]),
    );
    await createFileTree(directory.path, sources);
    commitAll(directory.path);
    const started = performance.now();
    const initialized = await run(directory.path, ['init', '--yes', '--runner', 'bun']);
    const initMs = performance.now() - started;
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initMs).toBeLessThan(60_000);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    expect(git(directory.path, ['-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Initialize fixture']).code).toBe(0);
    for (let index = 0; index < 10; index += 1) {
        const path = `scripts/task-${String(index)}.sh`;
        writeFileSync(join(directory.path, path), `${script}# Updated source.\n`);
        expect(git(directory.path, ['add', path]).code).toBe(0);
    }
    const measurements: number[] = [];
    for (const ceiling of [30_000, 5000]) {
        const start = performance.now();
        const checked = await run(directory.path, ['check', '--staged', '--json']);
        const elapsed = performance.now() - start;
        measurements.push(elapsed);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = JSON.parse(checked.stdout);
        if (measurements.length === 2)
            expect(report.checks.find((check: { check: string }) => check.check === 'bash/syntax')?.status).toBe(
                'cache',
            );
        console.log(
            `5000 files: staged ${measurements.length === 1 ? 'cold' : 'warm'} ${elapsed.toFixed(0)} ms; limit ${ceiling} ms`,
        );
        expect(elapsed).toBeLessThan(ceiling);
        expect(report.checks.some((check: { status: string }) => ['error', 'missing'].includes(check.status))).toBe(
            false,
        );
    }
    console.log(
        `5000 files: init ${initMs.toFixed(0)} ms; staged cold ${measurements[0]!.toFixed(0)} ms; warm ${measurements[1]!.toFixed(0)} ms`,
    );
}, 120_000);

test('apply and uninstall preserve later edits and unowned content while restoring a takeover original', async () => {
    await using directory = await testdir();
    const original = 'disable=SC2086\n';
    await createFileTree(directory.path, { '.shellcheckrc': original, 'entry.sh': 'echo example\n' });
    chmodSync(join(directory.path, '.shellcheckrc'), 0o640);
    commitAll(directory.path);
    const initialized = await run(directory.path, INIT);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const generated = join(directory.path, '.gspot/config/shellcheckrc');
    const edited = `${readFileSync(generated, 'utf8')}# Authored after installation.\n`;
    chmodSync(generated, 0o644);
    writeFileSync(generated, edited);
    writeFileSync(join(directory.path, '.gspot/authored.txt'), 'Preserve this file.\n');
    const applied = await run(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stderr).toContain('version pin was not changed');
    expect(readFileSync(generated, 'utf8')).toBe(edited);
    const removed = await run(directory.path, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toContain('preserved edited or unowned .gspot/config/shellcheckrc');
    expect(readFileSync(generated, 'utf8')).toBe(edited);
    expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('Preserve this file.\n');
    expect(readFileSync(join(directory.path, '.shellcheckrc'), 'utf8')).toBe(original);
    expect(statSync(join(directory.path, '.shellcheckrc')).mode & 0o777).toBe(0o640);
    expect(readFileSync(join(directory.path, '.gitignore'), 'utf8')).toContain('.gspot/state/');
});

test('init refuses a symlinked managed directory without writing outside the configuration root', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(directory.path, 'project');
    const outside = join(directory.path, 'outside');
    symlinkSync(outside, join(project, '.gspot'));
    const refused = await run(project, INIT);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    expect(existsSync(join(outside, 'mutation.lock'))).toBe(false);
    expect(existsSync(join(outside, 'ownership.json'))).toBe(false);
    expect(existsSync(join(project, 'gspot.toml'))).toBe(false);
    unlinkSync(join(project, '.gspot'));
    const corrected = await run(project, INIT);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
});

test('uninstall preview does not create ownership or recovery state', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n';
    await createFileTree(directory.path, { 'gspot.toml': policy });
    const preview = await run(directory.path, ['uninstall', '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});

test('a generated proposal cannot overwrite lifecycle recovery data', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ndirectory = ".gspot/state/recovery"\n',
        '.gspot/state/recovery/authored.txt': 'preserve recovery\n',
    });
    const refused = await run(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Lifecycle metadata is not a generated target');
    expect(readFileSync(join(directory.path, '.gspot/state/recovery/authored.txt'), 'utf8')).toBe(
        'preserve recovery\n',
    );
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

test('apply previews missing outputs without writing and rejects obsolete mutation flags', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n';
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const preview = await run(directory.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const result = JSON.parse(preview.stdout) as { isDryRun: boolean; drift: { path: string; kind: string }[] };
    expect(result.isDryRun).toBe(true);
    expect(result.drift).toContainEqual(
        expect.objectContaining({ path: '.gspot/config/shellcheckrc', kind: 'missing' }),
    );
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});

test('malformed authored blocks refuse apply before generated files change', async () => {
    await using directory = await testdir();
    const authored = '# Preserve this file\n<!-- >>> gspot managed >>> -->\nUnclosed instructions.\n';
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await run(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('incomplete or repeated');
    expect(readFileSync(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    writeFileSync(join(directory.path, 'AGENTS.md'), `${authored}<!-- <<< gspot managed <<< -->\n`);
    const corrected = await run(directory.path, ['apply']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(true);
});

test('a configuration below the Git root owns only its own project writes and changed paths', async () => {
    await using directory = await testdir();
    const outerPolicy = 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n';
    const innerPolicy = 'version = 1\nconfigurations = ["sql"]\n[rules]\ninstall = false\n';
    await createFileTree(directory.path, {
        'gspot.toml': outerPolicy,
        '.gspot/authored.txt': 'Preserve outside the configuration root.\n',
        'outside.sh': 'echo original\n',
        'app/gspot.toml': innerPolicy,
        'app/src/query.sql': 'SELECT 1;\n',
    });
    commitAll(directory.path);
    const app = join(directory.path, 'app');
    const source = join(app, 'src');
    const applied = await run(source, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(existsSync(join(app, '.gspot/config/sqlfluff.cfg'))).toBe(true);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    const selected = await run(source, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(outerPolicy);
    expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe(
        'Preserve outside the configuration root.\n',
    );
    expect(readFileSync(join(app, 'gspot.toml'), 'utf8')).toContain('level = "all"');
    writeFileSync(join(app, 'src/query.sql'), 'SELECT 2;\n');
    writeFileSync(join(directory.path, 'outside.sh'), 'if then\n');
    const checked = await run(source, ['check', '--changed=HEAD', '--only', 'sql/syntax', '--no-cache', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const checks = (JSON.parse(checked.stdout) as { checks: { check: string; files: number }[] }).checks;
    expect(checks.map(({ check, files }) => ({ check, files }))).toStrictEqual([{ check: 'sql/syntax', files: 1 }]);
});

test('malformed shared YAML refuses apply before any generated configuration is published', async () => {
    await using directory = await testdir();
    const authored = 'pre-commit: [unfinished\n';
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[hooks]\ntool = "lefthook"\n[rules]\ninstall = false\n',
        'lefthook.yml': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await run(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('valid YAML mapping');
    expect(readFileSync(join(directory.path, 'lefthook.yml'), 'utf8')).toBe(authored);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    expect(existsSync(join(directory.path, '.gitignore'))).toBe(false);
    writeFileSync(join(directory.path, 'lefthook.yml'), '# Authored hook settings\npre-commit:\n  parallel: true\n');
    const corrected = await run(directory.path, ['apply']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(true);
    expect(readFileSync(join(directory.path, 'lefthook.yml'), 'utf8')).toContain('parallel: true');
});

test('a fresh Git clone adopts exact generated bytes without changing checkout permissions and preserves authored files on uninstall', async () => {
    await using original = await testdir();
    await using clone = await testdir();
    await createFileTree(original.path, { 'entry.sh': 'echo example\n', '.gspot/authored.txt': 'authored sentinel\n' });
    commitAll(original.path);
    const initialized = await run(original.path, INIT);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    commitAll(original.path);
    const cloned = await spawn(['git', 'clone', '--quiet', '--no-local', original.path, clone.path], {
        cwd: original.path,
    });
    expect(cloned.code, cloned.stderr).toBe(0);
    const config = join(clone.path, '.gspot/config/shellcheckrc');
    const bytes = readFileSync(config);
    expect(statSync(config).mode & 0o777).toBe(0o644);
    const preview = await run(clone.path, ['uninstall', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect((JSON.parse(preview.stdout) as { plan: { remove: string[] } }).plan.remove).not.toContain(
        '.gspot/config/shellcheckrc',
    );
    const applied = await run(clone.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(
        (JSON.parse(applied.stdout) as { notes: string[] }).notes.filter((note) => note.includes('shellcheckrc')),
    ).toStrictEqual([]);
    expect(readFileSync(config)).toStrictEqual(bytes);
    expect(statSync(config).mode & 0o777).toBe(0o644);
    const repeated = await run(clone.path, ['apply', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as { written: string[] }).written).toStrictEqual([]);
    const unchanged = await spawn(['git', 'diff', '--exit-code'], { cwd: clone.path });
    expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
    const removed = await run(clone.path, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readFileSync(config)).toStrictEqual(bytes);
    expect(statSync(config).mode & 0o777).toBe(0o644);
    expect(readFileSync(join(clone.path, '.gspot/authored.txt'), 'utf8')).toBe('authored sentinel\n');
});

test('untracked exact generated content survives uninstall and later apply adoption', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'entry.sh': 'echo example\n' });
    const initialized = await run(directory.path, INIT);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const config = join(directory.path, '.gspot/config/shellcheckrc');
    const bytes = readFileSync(config);
    const mode = statSync(config).mode & 0o777;
    unlinkSync(join(directory.path, '.gspot/state/ownership.json'));
    const preview = await run(directory.path, ['uninstall', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect((JSON.parse(preview.stdout) as { plan: { remove: string[] } }).plan.remove).not.toContain(
        '.gspot/config/shellcheckrc',
    );
    const removed = await run(directory.path, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readFileSync(config)).toStrictEqual(bytes);
    const applied = await run(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const restored = await run(directory.path, ['uninstall', '--yes']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    expect(readFileSync(config)).toStrictEqual(bytes);
    expect(statSync(config).mode & 0o777).toBe(mode);
});

test.each([false, true])(
    'uninstall preserves tracked template copies without local ownership (apply first: %s)',
    async (applyFirst) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
            'entry.sh': 'echo example\n',
        });
        const session = await openSession(directory.path);
        const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        });
        const config = generated.files.find((file) => file.path === '.gspot/config/shellcheckrc')!;
        const instructions = generated.blocks.find((block) => block.path === 'AGENTS.md')!;
        const originals = {
            [config.path]: config.content,
            [instructions.path]: applyBlock('Authored instructions.\n', instructions.block, instructions.style),
            '.gspot/version': session.version + '\n',
        };
        await createFileTree(directory.path, originals);
        for (const args of [['init'], ['add', '--force', '.']]) {
            const git = await spawn(['git', ...args], { cwd: directory.path });
            expect(git.code, git.stderr).toBe(0);
        }
        if (applyFirst) {
            const applied = await run(directory.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        }
        const removed = await run(directory.path, ['uninstall', '--yes']);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        for (const [path, content] of Object.entries(originals)) {
            expect(readFileSync(join(directory.path, path), 'utf8')).toBe(content);
            expect(statSync(join(directory.path, path)).mode & 0o777).toBe(0o644);
        }
    },
);

test.each(['before', 'after'] as const)(
    'uninstall recovers an interrupted publication %s replacement and removes its recorded output',
    async (point) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'entry.sh': 'echo example\n' });
        const initialized = await run(directory.path, INIT);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const recordPath = join(directory.path, '.gspot/state/ownership.json');
        const state = ownershipSchema.parse(JSON.parse(readFileSync(recordPath, 'utf8')));
        const path = '.gspot/config/shellcheckrc';
        const entry = state.files.find((file) => file.path === path)!;
        state.files = state.files.filter((file) => file.path !== path);
        state.pending = [{ path, after: entry.installed, entry }];
        writeFileSync(recordPath, JSON.stringify(state));
        if (point === 'before') unlinkSync(join(directory.path, path));
        const preview = await run(directory.path, ['uninstall', '--dry-run', '--json']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect((JSON.parse(preview.stdout) as { plan: { remove: string[] } }).plan.remove).toContain(path);
        expect(ownershipSchema.parse(JSON.parse(readFileSync(recordPath, 'utf8'))).pending).toStrictEqual(
            state.pending,
        );
        const removed = await run(directory.path, ['uninstall', '--yes']);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(existsSync(join(directory.path, path))).toBe(false);
        const recovered = ownershipSchema.parse(JSON.parse(readFileSync(recordPath, 'utf8')));
        expect(recovered.pending).toBeUndefined();
        expect(recovered.files.map((file) => file.path)).not.toContain(path);
    },
);
