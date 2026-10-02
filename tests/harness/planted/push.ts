// The pre-push hook checks exactly the pushed objects and leaves the working tree alone.
import { join } from 'node:path';
import { expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { gitOutput } from '#tests/harness/cli/git.ts';
import { gspot } from '#tests/harness/cli/command.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { policyOf } from '#tests/harness/cli/policy.ts';

/** Creates reviewed and broken commits beneath conflicting working-tree bytes for push selection. */
export async function preparePushRepository(
    root: string,
): Promise<{ base: string; reviewed: string; broken: string; command: string[]; zero: string }> {
    await createFileTree(root, {
        'gspot.toml': policyOf(['bash'], '[rules]\ninstall = false\n'),
        'changed.sh': 'echo base\n',
        'legacy.sh': 'if then\n',
    });
    for (const args of [
        ['init', '-q'],
        ['add', '-A'],
        ['commit', '-qm', 'base'],
    ])
        gitOutput(root, args);
    const base = gitOutput(root, ['rev-parse', 'HEAD']);
    writeFileSync(join(root, 'changed.sh'), 'echo reviewed\n');
    gitOutput(root, ['add', 'changed.sh']);
    gitOutput(root, ['commit', '-qm', 'reviewed']);
    const reviewed = gitOutput(root, ['rev-parse', 'HEAD']);
    gitOutput(root, ['branch', 'reviewed', reviewed]);
    writeFileSync(join(root, 'changed.sh'), 'if then\n');
    gitOutput(root, ['add', 'changed.sh']);
    gitOutput(root, ['commit', '-qm', 'unreviewed']);
    const broken = gitOutput(root, ['rev-parse', 'HEAD']);
    writeFileSync(join(root, 'changed.sh'), 'echo repaired only in the working tree\n');
    writeFileSync(join(root, 'gspot.toml'), 'invalid working policy');
    const command = [
        process.execPath,
        gspot,
        'check',
        '--push',
        '--only',
        'bash/syntax',
        '--json',
        '--',
        'origin',
        'unused',
    ];
    return { base, reviewed, broken, command, zero: '0'.repeat(base.length) };
}

/**
 * Expects the push repository to keep its broken head and the working-tree bytes the push must not read or change.
 * @param root the push repository
 * @param head the broken commit the repository was left at
 */
export function expectWorkingTreeKept(root: string, head: string): void {
    expect(gitOutput(root, ['rev-parse', 'HEAD'])).toBe(head);
    expect(readFileSync(join(root, 'gspot.toml'), 'utf8')).toBe('invalid working policy');
    expect(readFileSync(join(root, 'changed.sh'), 'utf8')).toBe('echo repaired only in the working tree\n');
}
