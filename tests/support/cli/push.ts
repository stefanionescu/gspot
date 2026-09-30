// The pre-push hook checks exactly the pushed objects and leaves the working tree alone.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { gitOutput } from '#tests/support/cli/git.ts';
import { gspot } from '#tests/support/cli/command.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

/** Creates reviewed and broken commits beneath conflicting working-tree bytes for push selection. */
export async function preparePushRepository(
    root: string,
): Promise<{ base: string; reviewed: string; broken: string; command: string[]; zero: string }> {
    await createFileTree(root, {
        'gspot.toml': policyOf(['bash'], '[guides]\ninstall = false\n'),
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
