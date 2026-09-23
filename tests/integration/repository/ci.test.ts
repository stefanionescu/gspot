import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { git } from '#tests/support/cli/planted.ts';
import { run } from '#cli/platform/spawn.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const workflow = Bun.YAML.parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')) as {
    jobs: { affected: { steps: { name?: string; run?: string }[] } };
};
const step = workflow.jobs.affected.steps.find((entry) => entry.name === 'Check affected inputs')!;

test('repository CI checks the committed change, preserves reports on invalid bases, and accepts a correction', async () => {
    await using sandbox = await testdir();
    const command = [
        process.execPath,
        '-e',
        'for (const path of process.argv.slice(1)) if ((await Bun.file(path).text()).includes("bad")) { console.log(path + ": invalid input"); process.exitCode = 1; }',
        '{files}',
    ];
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\npresets = []\n[[check]]\nname = "project/content"\nstage = "commit"\npaths = ["*.txt"]\ncommand = ${JSON.stringify(command)}\n[check.output]\nformat = "lines"\n`,
        '.gspot/version': `${GSPOT_VERSION}\n`,
        'changed.txt': 'valid\n',
        'legacy.txt': 'bad\n',
    });
    const commit = () => {
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        expect(
            git(sandbox.path, [
                '-c',
                'user.name=Example',
                '-c',
                'user.email=example@example.com',
                'commit',
                '-qm',
                'Fixture',
            ]).code,
        ).toBe(0);
        return git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
    };
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    const base = commit();
    writeFileSync(join(sandbox.path, 'changed.txt'), 'bad\n');
    commit();
    writeFileSync(join(sandbox.path, 'changed.txt'), 'working tree correction\n');
    const execute = (comparison: string) =>
        run(['bash', '-euo', 'pipefail', '-c', step.run!], {
            cwd: sandbox.path,
            env: { GSPOT_CI_BASE: comparison, GITHUB_WORKSPACE: root },
            timeoutMs: 30_000,
        });
    const failed = await execute(base);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.stdout).toContain('changed.txt');
    expect(failed.stdout).not.toContain('legacy.txt');
    const report = join(sandbox.path, '.gspot/report.json');
    const held = readFileSync(report);
    for (const invalid of ['$(touch injected)', 'f'.repeat(40)]) {
        const refused = await execute(invalid);
        expect(refused.code).toBe(2);
        expect(readFileSync(report)).toEqual(held);
    }
    commit();
    const corrected = await execute(base);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const firstPush = await execute('0'.repeat(40));
    expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
    expect(firstPush.stdout).toContain('legacy.txt');
});
