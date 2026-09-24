import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { acceptanceRun } from '#tests/support/cli/worktree.ts';

test('a detected reference project reports its syntax defect, accepts its correction, and preserves authored input', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'entry.sh': 'if then\n',
        '.gspot/baselines/bash.syntax.all.json': JSON.stringify({
            check: 'bash/syntax',
            rule: 'all',
            count: 100,
            recorded: '2026-01-01',
            paths: { 'entry.sh': 100 },
        }),
        'authored.txt': 'Keep this authored input.\n',
    });
    commitAll(repository.path);
    const result = await acceptanceRun({
        repository: repository.path,
        checks: ['bash/syntax'],
        corrections: { 'entry.sh': 'echo example\n' },
    });
    expect(result.init).toContain('written: gspot.toml');
    expect(result.report.exitCode).toBe(1);
    expect(result.report.skips).toStrictEqual([]);
    expect(result.report.checks).toHaveLength(1);
    expect(result.report.checks[0]).toMatchObject({
        check: 'bash/syntax',
        status: 'fail',
        files: 1,
        findings: [
            { check: 'bash/syntax', file: 'entry.sh', line: 1, message: "syntax error near unexpected token `then'" },
            { check: 'bash/syntax', file: 'entry.sh', line: 1, message: "`if then'" },
        ],
    });
    expect(result.corrected.exitCode).toBe(0);
    expect(result.corrected.skips).toStrictEqual([]);
    expect(result.corrected.failed).toStrictEqual([]);
    expect(result.corrected.checks).toHaveLength(1);
    expect(result.corrected.checks[0]).toMatchObject({
        check: 'bash/syntax',
        status: 'ok',
        files: 1,
        findings: [],
    });
    expect(await Bun.file(join(repository.path, 'entry.sh')).text()).toBe('if then\n');
    expect(await Bun.file(join(repository.path, 'authored.txt')).text()).toBe('Keep this authored input.\n');
});
