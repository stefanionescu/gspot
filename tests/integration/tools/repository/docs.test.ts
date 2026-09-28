import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { run as runCommand } from '#cli/platform/spawn.ts';
import example from '#docs/src/components/home/repository.json';

test('the quickstart supplies every policy, project, defect, and correction shown on the homepage', () => {
    const guide = readFileSync(
        new URL('../../../../docs/src/content/docs/guides/quick-start.md', import.meta.url),
        'utf8',
    );
    for (const source of [example.policy, example.project]) expect(guide).toContain(source.trimEnd());
    for (const file of example.files) {
        expect(guide).toContain(file.path);
        expect(guide).toContain(file.before.trimEnd());
        expect(guide).toContain(file.after.trimEnd());
    }
});

test('the homepage repository reports its captured findings and accepts working corrections', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: toolsPath(['shellcheck', 'shfmt']) };
    await createFileTree(sandbox.path, {
        'gspot.toml': example.policy,
        'pyproject.toml': example.project,
        ...Object.fromEntries(example.files.map((file) => [file.path, file.before])),
    });
    for (const command of ['apply', 'install']) {
        const prepared = await run(sandbox.path, [command], environment);
        expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    }
    const args = ['check', '--no-cache', '--json'];
    const failed = await run(sandbox.path, args, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const before = reportSchema.parse(JSON.parse(failed.stdout));
    expect(
        before.checks.filter((check) => check.status === 'fail'),
        failed.stdout,
    ).toHaveLength(example.failedChecks);
    expect(before.checks.flatMap((check) => check.findings)).toMatchObject(example.findings);
    expect(before.checks.flatMap((check) => check.findings)).toHaveLength(example.findings.length);
    for (const file of example.files) await Bun.write(join(sandbox.path, file.path), file.after);
    const corrected = await run(sandbox.path, args, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const after = reportSchema.parse(JSON.parse(corrected.stdout));
    expect(after.checks.filter((check) => check.status === 'ok')).toHaveLength(example.passedChecks);
    expect(after.checks.flatMap((check) => check.findings)).toStrictEqual([]);
    expect(after.checks.filter((check) => check.status === 'skipped')).toMatchObject([
        { check: 'python/import-linter', note: 'This scope has no tool.importlinter configuration.' },
    ]);
    expect(after.checks.filter((check) => check.status === 'skipped')).toHaveLength(example.skippedChecks);
}, 120_000);

test('the corrected parser rejects non-JSON input and the shell script accepts archive paths with spaces', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...Object.fromEntries(example.files.map((file) => [file.path, file.after])),
        'message.txt': 'hello\n',
    });
    const options = { cwd: sandbox.path };
    const python = 'from src.settings import normalize_settings; import sys; print(normalize_settings(sys.argv[1]))';
    const valid = await runCommand(['python', '-c', python, '{"retries": 3}'], options);
    expect(valid.code, valid.stderr).toBe(0);
    expect(valid.stdout.trim()).toBe('{"retries": 3}');
    const invalid = await runCommand(['python', '-c', python, 'not JSON'], options);
    expect(invalid.code).toBe(1);
    expect(invalid.stderr).toContain('JSONDecodeError');
    const archive = await runCommand(['tar', '-cf', 'release archive.tar', 'message.txt'], options);
    expect(archive.code, archive.stderr).toBe(0);
    const listed = await runCommand(['bash', 'scripts/list-archive.sh', 'release archive.tar'], options);
    expect(listed.code, listed.stderr).toBe(0);
    expect(listed.stdout.trim()).toBe('message.txt');
});
