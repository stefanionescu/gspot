import { existsSync } from 'node:fs';
import { readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse, stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { findValueAt } from '#cli/system/tables.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { BROKEN_IF_SCRIPT, TERMS_SOURCE } from '#tests/config/setup/languages.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('an ignore without paths stops a command check and its fixer until unignore', async () => {
    await using sandbox = await createGitSandbox({});
    const command = buildProgramCommand('fakes/tool', '--text', 'executed', '--exit', '1', 'read.txt');
    const fix = buildProgramCommand('fakes/tool', '--text', 'corrected', 'corrected.txt');
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
    expect(existsSync(join(sandbox.path, 'read.txt'))).toBe(false);
    expect(existsSync(join(sandbox.path, 'corrected.txt'))).toBe(false);
    const removed = await runGspot(sandbox.path, ['unignore', 'project/quality']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await runGspot(sandbox.path, commandArguments);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(await readFile(join(sandbox.path, 'read.txt'), 'utf8')).toBe('executed');
});

test('an ignored folder covers its subfolders, and a negated file in it is still checked', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'legacy scripts/nested/example.sh': BROKEN_IF_SCRIPT,
        'legacy scripts/required.sh': BROKEN_IF_SCRIPT,
        'entry.sh': 'echo example\n',
    });

    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'project/bash-syntax',
        '--reason',
        'The legacy files retain malformed syntax.',
        '--paths',
        'legacy scripts',
        '--paths',
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
        '--paths',
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
    const saved = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(saved['ignore']).toStrictEqual([{ paths: ['data/**'], reason }]);
    const typos = await readFile(join(sandbox.path, getManifestTarget('spelling', 'typos.toml')), 'utf8');
    expect(findValueAt(parse(typos), ['files', 'extend-exclude'])).toContain('data/**');
    expect(typos).toContain(`# ${reason}`);
    const removed = await runGspot(sandbox.path, ['unignore', '--paths', 'data/**']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const contents: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(contents).not.toHaveProperty('ignore');
});

test('ignore escapes the literal app/[id] and unignore removes its deleted path', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'app/[id]/terms/page.tsx': TERMS_SOURCE,
    });
    commitAll(sandbox.path);
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'structure/lone-files',
        '--paths',
        'app/[id]/**',
        '--reason',
        'Next.js route groups hold one page each.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toMatchObject([{ paths: [String.raw`app/\[id\]/**`] }]);
    expect(await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths')).toStrictEqual([]);
    await rm(join(sandbox.path, 'app/[id]'), { recursive: true });
    const restored = await runGspot(sandbox.path, ['unignore', 'structure/lone-files', '--paths', 'app/[id]/**']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    const contents: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(contents).not.toHaveProperty('ignore');
});
