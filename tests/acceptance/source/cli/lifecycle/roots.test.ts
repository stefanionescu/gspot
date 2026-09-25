// The configuration root confines every write: a linked managed directory is refused and a nested policy owns only its project.
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { expect, test } from 'bun:test';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const INIT = initArgs(['bash']);

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
