import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { findRoot } from '#cli/repository/read.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { readdir, symlink, readFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

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
        'project/gspot.toml': buildSandboxSettings([], {
            tables: `[[command_check]]\nid = "project/storage"\npaths = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'console.log("Exact finding"); process.exitCode=1'])}\noutput = { format = "lines" }\n`,
        }),
        'outside/sentinel': 'authored outside\n',
    });
    const project = join(folder.path, 'project');
    const outside = join(folder.path, 'outside');
    await symlink(outside, join(project, '.gspot'));
    const refused = parseCheckReport(await runGspot(project, ['check', '--json']));
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.report.checks.find((result) => result.check === 'gspot/generated-files')?.note).toContain('.gspot');
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored outside\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
    expect(await isOnDisk(join(project, 'gspot.toml'))).toBe(true);
});

test.each([
    {
        name: 'the nearest gspot.toml',
        files: { 'gspot.toml': buildSandboxSettings([], { rules: true }) },
        start: 'nested',
    },
    { name: 'the requested folder when no gspot.toml exists', files: {}, start: '' },
])('a folder with no Git finds $name', async ({ files, start }) => {
    await using sandbox = await testdir({ ...files, 'nested/source.ts': 'export {});\n' });

    expect(findRoot(join(sandbox.path, start))).toBe(sandbox.path);
});
