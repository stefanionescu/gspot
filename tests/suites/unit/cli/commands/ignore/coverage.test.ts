import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/runs/command.ts';
import { rm, unlink, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { LITERAL_ROUTE_CASES, FUNCTION_NAME_IGNORES } from '#tests/config/commands/ignore.ts';

test('an ignore without paths stops a command check and its fixer until unignore', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
    const command = [process.execPath, '-e', "await Bun.write('read.txt', 'executed'); process.exitCode = 1;"];
    const fix = [process.execPath, '-e', "await Bun.write('corrected.txt', 'corrected');"];
    const settings = buildSandboxSettings([], {
        tables: stringify({
            command_check: [
                {
                    id: 'project/quality',
                    output: { format: 'none' },
                    command,
                    fix,
                    paths: ['entry.sh'],
                    stage: 'commit',
                },
            ],
        }),
    });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const commandArguments = ['check', '--only', 'project/quality', '--json'];
    const before = await runGspot(sandbox.path, commandArguments);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(await readFile(join(sandbox.path, 'read.txt'), 'utf8')).toBe('executed');
    await unlink(join(sandbox.path, 'read.txt'));
    const reason = 'The sandbox preserves the command failure.';
    const ignored = await runGspot(sandbox.path, ['ignore', 'project/quality', '--reason', reason]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const skipped = parseCheckReport(await runGspot(sandbox.path, [...commandArguments, '--fix']));
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    expect(skipped.report.checks).toMatchObject([
        { check: 'project/quality', status: 'skipped', cause: 'ignore', findings: [] },
    ]);
    expect(skipped.report.ignores).toStrictEqual([{ check: 'project/quality', reason }]);
    expect(await isOnDisk(join(sandbox.path, 'read.txt'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'corrected.txt'))).toBe(false);
    const removed = await runGspot(sandbox.path, ['unignore', 'project/quality']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await runGspot(sandbox.path, commandArguments);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(await readFile(join(sandbox.path, 'read.txt'), 'utf8')).toBe('executed');
});

test('an ignored folder covers its subfolders, and a negated file in it is still checked', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'legacy scripts/nested/example.sh': 'if then\n',
        'legacy scripts/required.sh': 'if then\n',
        'entry.sh': 'echo example\n',
    });

    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'project/bash-syntax',
        '--reason',
        'The legacy files retain malformed syntax.',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const command = ['check', '--only', 'project/bash-syntax', '--json'];
    const checked = parseCheckReport(await runGspot(sandbox.path, command));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(new Set(checked.report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/required.sh']),
    );
    await writeFile(join(sandbox.path, 'legacy scripts/required.sh'), 'echo corrected\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const removed = await runGspot(sandbox.path, [
        'unignore',
        'project/bash-syntax',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = parseCheckReport(await runGspot(sandbox.path, command));
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(new Set(restored.report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/nested/example.sh']),
    );
});

test('ignore without a check keeps the paths out of every check and every config file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo entry\n',
        'data/facts.txt': 'Nebulix\n',
    });

    const reason = 'Product facts copy words as printed on the packaging.';
    const result = await runGspot(sandbox.path, ['ignore', '--paths', 'data/**', '--reason', reason]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toStartWith('Ignored every check for data/**.\n');
    const saved = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(saved['ignore']).toStrictEqual([{ paths: ['data/**'], reason }]);
    const typos = await readFile(join(sandbox.path, findManifestTarget('spelling', 'typos.toml')), 'utf8');
    expect(typos).toEndWith(`  # ${reason}\n  "data/**",\n]\n`);
    const removed = await runGspot(sandbox.path, ['unignore', '--paths', 'data/**']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const contents: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(contents).not.toHaveProperty('ignore');
});

test.each([...LITERAL_ROUTE_CASES])(
    'ignore and unignore accept $folder before and after it disappears (removed: $removed)',
    async ({ folder, path, escaped, removed }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['typescript']),
            [`${folder}/terms/page.tsx`]: 'export default function Terms() { return null; }\n',
        });
        commitAll(sandbox.path);
        const ignored = await runGspot(sandbox.path, [
            'ignore',
            'structure/lone-files',
            '--paths',
            path,
            '--reason',
            'Next.js route groups hold one page each.',
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
        expect(written['ignore']).toMatchObject([{ paths: [escaped] }]);
        expect(await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths')).toStrictEqual([]);
        if (removed) await rm(join(sandbox.path, folder), { recursive: true });
        const restored = await runGspot(sandbox.path, ['unignore', 'structure/lone-files', '--paths', path]);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        expect(restored.stdout).toStartWith(`Removed 1 ignore for structure/lone-files for ${path}.`);
        const contents: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
        expect(contents).not.toHaveProperty('ignore');
    },
);

test('gspot ignore --names writes the names of a structure/trivial-functions ignore', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
        'main.py': '',
    });
    const result = await runGspot(sandbox.path, [
        'ignore',
        'structure/trivial-functions',
        '--names',
        'define_schema',
        'execute',
        '--paths',
        'nodes/**',
        '--reason',
        'The host application calls these hooks by name.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toStrictEqual(FUNCTION_NAME_IGNORES);
});
