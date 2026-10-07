// The configuration root bounds every write: a linked managed directory is refused and a nested policy owns only its project.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { existsSync, unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

const INIT = buildInitArguments(['bash']);

test('init refuses a symlinked managed directory without writing outside the configuration root', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(directory.path, 'project');
    const outside = join(directory.path, 'outside');
    symlinkSync(outside, join(project, '.gspot'));
    const refused = await runGspot(project, INIT);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    expect(existsSync(join(outside, 'mutation.lock'))).toBe(false);
    expect(existsSync(join(outside, 'ownership.json'))).toBe(false);
    expect(existsSync(join(project, 'gspot.toml'))).toBe(false);
    unlinkSync(join(project, '.gspot'));
    const corrected = await runGspot(project, INIT);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
});

test('a configuration below the Git root owns only its own project writes and changed paths', async () => {
    await using directory = await testdir();
    const outerPolicy = buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' });
    const innerPolicy = buildPolicy(['sql'], {
        tables: '[agent_rules]\nenabled = false\n[tools.sqlfluff]\ndialect = "postgres"\n',
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
    expect(existsSync(join(app, '.gspot/config/sqlfluff.cfg'))).toBe(true);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    const selected = await runGspot(source, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(outerPolicy);
    expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe(
        'Preserve outside the configuration root.\n',
    );
    expect(readFileSync(join(app, 'gspot.toml'), 'utf8')).toContain('level = "all"');
    writeFileSync(join(app, 'src/query.sql'), 'SELECT 2;\n');
    writeFileSync(join(directory.path, 'outside.sql'), 'SELECT FROM;\n');
    const checked = await runGspot(source, [
        'check',
        '--changed',
        '--base',
        'HEAD',
        '--only',
        'sql/trivial-functions',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const checks = (JSON.parse(checked.stdout) as RunReport).checks;
    expect(checks.map(({ check, fileCount }) => ({ check, fileCount }))).toStrictEqual([
        { check: 'sql/trivial-functions', fileCount: 1 },
    ]);
});
