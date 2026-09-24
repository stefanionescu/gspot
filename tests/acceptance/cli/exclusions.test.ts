import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';

test('excluded directories stay out of checks until the policy removes their exclusion', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["bash"]\nexclude = ["legacy scripts"]\n[rules]\ninstall = false\n',
        'entry.sh': 'echo example\n',
        'legacy scripts/broken.sh': 'if then\n',
    });
    const before = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect((JSON.parse(before.stdout) as { checks: { files: number }[] }).checks[0]?.files).toBe(1);
    const changed = await run(directory.path, ['set', 'exclude', 'legacy scripts', '--remove']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const after = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const checked = (JSON.parse(after.stdout) as { checks: { files: number; findings: { file: string }[] }[] })
        .checks[0];
    expect(checked?.files).toBe(2);
    expect(checked?.findings.map((finding) => finding.file)).toStrictEqual([
        'legacy scripts/broken.sh',
        'legacy scripts/broken.sh',
    ]);
    writeFileSync(join(directory.path, 'legacy scripts/broken.sh'), 'echo corrected\n');
    const corrected = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
