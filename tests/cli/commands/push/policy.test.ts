// Full-tree policy checks read the pushed revision's unchanged files.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { gspot, runGspot } from '#tests/harness/gspot.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';

test('full-tree pre-push policy checks unchanged files in the pushed object', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        'changed.sh': 'echo base\n',
        'legacy.sh': 'if then\n',
    });
    commitAll(sandbox.path);
    const base = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await Bun.write(join(sandbox.path, 'changed.sh'), 'echo changed\n');
    writeFileSync(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['bash'], { tables: '[hooks]\n[agent_rules]\nenabled = false\n' }),
    );
    const configured = await runGspot(sandbox.path, ['set', 'hooks.push_files', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    expect(git(sandbox.path, ['add', 'gspot.toml', 'changed.sh']).code).toBe(0);
    expect(git(sandbox.path, ['commit', '-qm', 'full pushed tree']).code).toBe(0);
    const pushedCommit = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
    const all = await processes.run(
        [
            process.execPath,
            gspot,
            'check',
            '--hook',
            'pre-push',
            '--only',
            'bash/syntax',
            '--json',
            '--',
            'origin',
            'unused',
        ],
        {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${pushedCommit} refs/heads/main ${base}\n`,
        },
    );
    expect(all.code, all.stdout + all.stderr).toBe(1);
    expect(
        (JSON.parse(all.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings.map((finding) => finding.file),
    ).toStrictEqual(['legacy.sh', 'legacy.sh']);
});
