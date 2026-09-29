// The Bash guide examples pass the generated ShellCheck and shfmt configurations, and an unsafe expansion fails.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { allRuleExamples } from '#cli/agents/examples.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { generatedFile } from '#tests/support/cli/generated/files.ts';

const examples = allRuleExamples().filter((example) => example.language === 'bash');

test.each(
    [...new Set(examples.map((example) => example.file))].flatMap((path) =>
        (['recommended', 'all'] as const).map((level) => [level, path] as const),
    ),
)('Bash %s %s examples reject unsafe expansion and accept its correction', async (level, path) => {
    await using sandbox = await testdir();
    const selected = examples.filter((example) => example.file === path);
    expect(selected.length).toBeGreaterThan(0);
    const paths = selected.map((example) => `example-${String(example.line)}.sh`);
    await createFileTree(sandbox.path, {
        ...Object.fromEntries(selected.map((example, index) => [paths[index]!, example.body])),
        'rejected.sh': "printf '%s\\n' $1\n",
        shellcheckrc: await generatedFile(policyOf(['bash'], '', level), '.gspot/config/shellcheckrc'),
    });
    const command = [
        'shellcheck',
        '--rcfile',
        'shellcheckrc',
        '--severity=style',
        '--format=json',
        ...paths,
        'rejected.sh',
    ];
    const rejected = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(rejected.exitCode, rejected.stderr.toString()).toBe(1);
    expect(JSON.parse(rejected.stdout.toString())).toMatchObject([{ file: 'rejected.sh', code: 2086 }]);
    await Bun.write(join(sandbox.path, 'rejected.sh'), 'printf \'%s\\n\' "$1"\n');
    const corrected = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
    expect(JSON.parse(corrected.stdout.toString())).toStrictEqual([]);
    const formatted = Bun.spawnSync(['shfmt', '-d', '-i', '2', '-ci', '-s', ...paths], {
        cwd: sandbox.path,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(formatted.exitCode, formatted.stdout.toString() + formatted.stderr.toString()).toBe(0);
});
