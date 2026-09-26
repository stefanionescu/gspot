import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { run as runCommand } from '#cli/platform/spawn.ts';
import example from '#docs/src/components/home/bash-syntax.json';
import packageManifest from '#cli-package' with { type: 'json' };

const { version: GSPOT_VERSION } = packageManifest;

test('the published syntax example produces the captured finding and accepts its correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
        '.gspot/version': `${GSPOT_VERSION}\n`,
        'greet.sh': example.broken,
    });
    const args = ['check', '--only', 'bash/syntax', '--no-cache'];
    const failed = await run(sandbox.path, args);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const expectedLines = example.failed.split('\n').filter((line) => /^\s+(?:greet.sh|help:)/u.test(line));
    expect(expectedLines.length).toBeGreaterThan(0);
    for (const line of expectedLines) {
        expect(failed.stdout).toContain(line);
    }
    await Bun.write(join(sandbox.path, 'greet.sh'), example.corrected);
    const corrected = await run(sandbox.path, args);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.stdout).toContain('1 check passed, 0 checks failed');
    expect(corrected.stdout).not.toContain('failed:');
});

test('the Bash retry example preserves the final failure status', async () => {
    const source = readFileSync(
        new URL('../../../../packages/cli/rules/language/bash/OPERATIONS.md', import.meta.url),
        'utf8',
    );
    const snippet = [...source.matchAll(/```bash\n([\s\S]*?)```/gu)]
        .map((match) => match[1]!)
        .find((block) => block.includes('retry_retryable()'));
    expect(snippet?.trim()).toBeTruthy();
    const cwd = fileURLToPath(new URL('../../../..', import.meta.url));
    const failed = await runCommand(['bash', '-c', `${snippet}\nretry_retryable probe 2 0 bash -c 'exit 7'`], { cwd });
    expect(failed.code, failed.stderr).toBe(7);
    expect(failed.stderr).toContain('attempt=2/2 status=failed exit=7');
    const passed = await runCommand(['bash', '-c', `${snippet}\nretry_retryable probe 2 0 true`], { cwd });
    expect(passed.code, passed.stderr).toBe(0);
    expect(passed.stderr).toContain('attempt=1/2 status=success');
});

test('the Bash sentinel example preserves trailing newlines and rejects producer failure', async () => {
    const source = readFileSync(
        new URL('../../../../packages/cli/rules/language/bash/LANGUAGE.md', import.meta.url),
        'utf8',
    );
    const snippet = [...source.matchAll(/```bash\n([\s\S]*?)```/gu)]
        .map((match) => match[1]!)
        .find((block) => block.includes('content_with_sentinel='));
    expect(snippet?.trim()).toBeTruthy();
    const cwd = fileURLToPath(new URL('../../../..', import.meta.url));
    const capture = `capture() {\n${snippet}\nprintf '%s' "$content";\n}\ncapture`;
    const passed = await runCommand(['bash', '-c', `some_command() { printf 'value\\n\\n'; };\n${capture}`], { cwd });
    expect(passed.code, passed.stderr).toBe(0);
    expect(passed.stdout).toBe('value\n\n');
    const failed = await runCommand(['bash', '-c', `some_command() { return 9; };\n${capture}`], { cwd });
    expect(failed.code, failed.stderr).toBe(1);
    expect(failed.stdout).toBe('');
});
