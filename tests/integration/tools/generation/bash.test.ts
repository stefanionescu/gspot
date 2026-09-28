import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { allRuleExamples } from '#cli/agents/examples.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSemgrep } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { generatedFile } from '#tests/support/cli/generated/files.ts';

const examples = allRuleExamples().filter((example) => example.language === 'bash');

test.each(['recommended', 'all'])(
    'Bash security rules expose their language identity at %s',
    async (level) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "${level}"\nconfigurations = ["bash", "security"]\n[rules]\ninstall = false\n`;
        const source = '#!/usr/bin/env bash\ncurl https://example.com/setup.sh | bash\neval "$1"\n';
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'script.sh': source });
        await installSemgrep(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
        const broken = await run(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const findings = (JSON.parse(broken.stdout) as RunReport).checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual([
            containing({ file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' }),
            containing({ file: 'script.sh', line: 3, rule: 'gspot.bash.eval' }),
        ]);
        expect(await Bun.file(join(sandbox.path, 'script.sh')).text()).toBe(source);
        const corrected = '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n';
        await Bun.write(join(sandbox.path, 'script.sh'), corrected);
        const clean = await run(sandbox.path, command);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'script.sh')).text()).toBe(corrected);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
    120_000,
);

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
        shellcheckrc: await generatedFile(
            `version = 1\nlevel = "${level}"\nconfigurations = ["bash"]\n`,
            '.gspot/config/shellcheckrc',
        ),
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
