// The configuration root bounds every write: a linked managed directory is refused and a nested policy owns only its project.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { STORAGE_COMMAND, LINKED_STORAGE_CASES } from '#tests/config/cli/commands/roots.ts';

const INIT = buildInitArguments(['bash']);

test.each(LINKED_STORAGE_CASES)('$name', async ({ command, path, source, sentinel, message, hasPolicy }) => {
    await using directory = await testdir();
    const project = join(directory.path, 'project');
    const outside = join(directory.path, 'outside');
    await createFileTree(directory.path, {
        [`project/${path}`]: source,
        'outside/sentinel': sentinel,
    });
    if (command === 'check') {
        await createFileTree(project, {
            'gspot.toml': buildPolicy([], {
                tables: `[check."project/storage"]\npaths = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', STORAGE_COMMAND])}\noutput = { format = "lines" }\n`,
            }),
        });
    }
    await symlink(outside, join(project, '.gspot'));
    const refused = await runGspot(project, command === 'init' ? INIT : ['check', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(
        command === 'check'
            ? (JSON.parse(refused.stdout) as CommandFailureJson).message
            : refused.stdout + refused.stderr,
    ).toContain(message);
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe(sentinel);
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
    expect(await pathExists(join(project, 'gspot.toml'))).toBe(hasPolicy);
});

test('a configuration below the Git root owns only its own project writes and changed paths', async () => {
    await using directory = await testdir();
    const outerPolicy = buildPolicy(['bash']);
    const innerPolicy = buildPolicy(['sql'], {
        tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
    });
    await createFileTree(directory.path, {
        'gspot.toml': outerPolicy,
        '.gspot/authored.txt': 'Preserve outside the configuration root.\n',
        'outside.sql': 'SELECT 1;\n',
        'app/gspot.toml': innerPolicy,
        'app/src/query.sql': 'SELECT 1;\n',
    });
    commitAll(directory.path);
    const app = join(directory.path, 'app');
    const source = join(app, 'src');
    const applied = await runGspot(source, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await pathExists(join(app, '.gspot/config/sqlfluff.cfg'))).toBe(true);
    expect(await pathExists(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    const selected = await runGspot(source, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(outerPolicy);
    expect(await readFile(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe(
        'Preserve outside the configuration root.\n',
    );
    expect(await readFile(join(app, 'gspot.toml'), 'utf8')).toContain('level = "all"');
    await writeFile(join(app, 'src/query.sql'), 'SELECT 2;\n');
    await writeFile(join(directory.path, 'outside.sql'), 'SELECT FROM;\n');
    const checked = await checkReport(source, [
        'check',
        '--changed',
        '--base',
        'HEAD',
        '--only',
        'sql/trivial-functions',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const checks = checked.report.checks;
    expect(checks.map(({ check, fileCount }) => ({ check, fileCount }))).toStrictEqual([
        { check: 'sql/trivial-functions', fileCount: 1 },
    ]);
});
