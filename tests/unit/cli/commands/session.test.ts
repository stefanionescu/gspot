import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { SQL_CHECK } from '#tests/config/sql.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';

test('a linked .gspot folder stops init, and nothing outside changes', async () => {
    await using directory = await testdir({ 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(directory.path, 'project');
    const outside = join(directory.path, 'outside');
    await symlink(outside, join(project, '.gspot'));
    const refused = await runGspot(project, buildInitArguments(['bash']));
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('.gspot');
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
    expect(await pathExists(join(project, 'gspot.toml'))).toBe(false);
});

test('a linked .gspot folder stops check, and nothing outside changes', async () => {
    await using directory = await testdir({
        'project/source.txt': 'input\n',
        'project/gspot.toml': settingsText([], {
            tables: `[[command_check]]\nname = "project/storage"\npaths = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'console.log("Exact finding"); process.exitCode=1'])}\noutput = { format = "lines" }\n`,
        }),
        'outside/sentinel': 'authored outside\n',
    });
    const project = join(directory.path, 'project');
    const outside = join(directory.path, 'outside');
    await symlink(outside, join(project, '.gspot'));
    const refused = await runGspot(project, ['check', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('.gspot');
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored outside\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
    expect(await pathExists(join(project, 'gspot.toml'))).toBe(true);
});

test('a gspot.toml below the Git root writes and checks only its own folder', async () => {
    await using directory = await testdir();
    const outerPolicy = settingsText(['bash']);
    const innerPolicy = settingsText(['sql'], {
        tables: SQL_CHECK + '[tools.sqlfluff]\ndialect = "postgres"\n',
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
        'project/read-sql',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const checks = checked.report.checks;
    expect(checks.map(({ check, fileCount }) => ({ check, fileCount }))).toStrictEqual([
        { check: 'project/read-sql', fileCount: 1 },
    ]);
});
