// The configuration root bounds every write: a linked managed directory is refused and a nested policy owns only its project.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { initArgs } from '#tests/harness/planted/init.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { existsSync, unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

const INIT = initArgs(['bash']);

test('init refuses a symlinked managed directory without writing outside the configuration root', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(directory.path, 'project');
    const outside = join(directory.path, 'outside');
    symlinkSync(outside, join(project, '.gspot'));
    const refused = await spawnGspot(project, INIT);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    expect(existsSync(join(outside, 'mutation.lock'))).toBe(false);
    expect(existsSync(join(outside, 'ownership.json'))).toBe(false);
    expect(existsSync(join(project, 'gspot.toml'))).toBe(false);
    unlinkSync(join(project, '.gspot'));
    const corrected = await spawnGspot(project, INIT);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
});

test('a configuration below the Git root owns only its own project writes and changed paths', async () => {
    await using directory = await testdir();
    const outerPolicy = policyOf(['bash'], '[guides]\ninstall = false\n');
    const innerPolicy = policyOf(['sql'], '[guides]\ninstall = false\n');
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
    const applied = await spawnGspot(source, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(existsSync(join(app, '.gspot/config/sqlfluff.cfg'))).toBe(true);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    const selected = await spawnGspot(source, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(outerPolicy);
    expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe(
        'Preserve outside the configuration root.\n',
    );
    expect(readFileSync(join(app, 'gspot.toml'), 'utf8')).toContain('level = "all"');
    writeFileSync(join(app, 'src/query.sql'), 'SELECT 2;\n');
    writeFileSync(join(directory.path, 'outside.sh'), 'if then\n');
    const checked = await spawnGspot(source, ['check', '--changed=HEAD', '--only', 'sql/syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const checks = (JSON.parse(checked.stdout) as { checks: { check: string; files: number }[] }).checks;
    expect(checks.map(({ check, files }) => ({ check, files }))).toStrictEqual([{ check: 'sql/syntax', files: 1 }]);
});
