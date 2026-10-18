import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { findRoot } from '#cli/repository/read.ts';
import { testdir, createFileTree } from 'testdirs';
import { SQL_CHECK } from '#tests/data/checks/sql.ts';
import { type RunReport } from '#cli/types/runs/check.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';

test('a linked .gspot folder stops init, and nothing outside changes', async () => {
    await using folder = await testdir({ 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(folder.path, 'project');
    const outside = join(folder.path, 'outside');
    await symlink(outside, join(project, '.gspot'));
    const refused = await runGspot(project, buildInitArguments(['bash']));
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('.gspot');
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
    expect(await isOnDisk(join(project, 'gspot.toml'))).toBe(false);
});

test('a linked .gspot folder stops check, and nothing outside changes', async () => {
    await using folder = await testdir({
        'project/source.txt': 'input\n',
        'project/gspot.toml': buildSettingsText([], {
            tables: `[[command_check]]\nname = "project/storage"\npaths = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'console.log("Exact finding"); process.exitCode=1'])}\noutput = { format = "lines" }\n`,
        }),
        'outside/sentinel': 'authored outside\n',
    });
    const project = join(folder.path, 'project');
    const outside = join(folder.path, 'outside');
    await symlink(outside, join(project, '.gspot'));
    const refused = await runGspot(project, ['check', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(
        (JSON.parse(refused.stdout) as RunReport).checks.find((result) => result.check === 'gspot/generated-files')
            ?.note,
    ).toContain('.gspot');
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored outside\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
    expect(await isOnDisk(join(project, 'gspot.toml'))).toBe(true);
});

test('a gspot.toml below the Git root writes and checks only its own folder', async () => {
    await using folder = await testdir();
    const outerPolicy = buildSettingsText(['bash']);
    const innerPolicy = buildSettingsText(['sql'], {
        tables: SQL_CHECK + '[tools.sqlfluff]\ndialect = "postgres"\n',
    });
    await createFileTree(folder.path, {
        'gspot.toml': outerPolicy,
        '.gspot/authored.txt': 'Preserve outside the configuration root.\n',
        'outside.sql': 'SELECT 1;\n',
        'app/gspot.toml': innerPolicy,
        'app/src/query.sql': 'SELECT 1;\n',
    });
    commitAll(folder.path);
    const app = join(folder.path, 'app');
    const source = join(app, 'src');
    const applied = await runGspot(source, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(app, '.gspot/config/sqlfluff.cfg'))).toBe(true);
    expect(await isOnDisk(join(folder.path, '.gspot/config/shellcheckrc'))).toBe(false);
    const selected = await runGspot(source, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(outerPolicy);
    expect(await readFile(join(folder.path, '.gspot/authored.txt'), 'utf8')).toBe(
        'Preserve outside the configuration root.\n',
    );
    expect(await readFile(join(app, 'gspot.toml'), 'utf8')).toContain('level = "all"');
    await writeFile(join(app, 'src/query.sql'), 'SELECT 2;\n');
    await writeFile(join(folder.path, 'outside.sql'), 'SELECT FROM;\n');
    const checked = await checkReport(source, ['check', '--changed', 'HEAD', '--only', 'project/read-sql', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const checks = checked.report.checks;
    expect(checks.map(({ check, fileCount }) => ({ check, fileCount }))).toStrictEqual([
        { check: 'project/read-sql', fileCount: 1 },
    ]);
});

test.each([
    { name: 'the nearest gspot.toml', files: { 'gspot.toml': 'configurations = []\n' }, start: 'nested' },
    { name: 'the requested folder when no gspot.toml exists', files: {}, start: '' },
])('a folder with no Git finds $name', async ({ files, start }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...files, 'nested/source.ts': 'export {});\n' });
    expect(findRoot(join(sandbox.path, start))).toBe(sandbox.path);
});
