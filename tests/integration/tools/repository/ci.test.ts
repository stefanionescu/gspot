import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'smol-toml';
import { run } from '#cli/platform/spawn.ts';
import { git } from '#tests/support/cli/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import packageManifest from '#cli-package' with { type: 'json' };

const { version: GSPOT_VERSION } = packageManifest;

const root = fileURLToPath(new URL('../../../..', import.meta.url));
const workflow = Bun.YAML.parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')) as {
    jobs: { affected: { steps: { name?: string; run?: string }[] } };
};
const step = workflow.jobs.affected.steps.find((entry) => entry.name === 'Check affected inputs')!;
const tasks = parse(readFileSync(join(root, 'mise.toml'), 'utf8'))['tasks'] as Record<string, Record<string, string>>;

test('repository CI checks the committed change, preserves reports on invalid bases, and accepts a correction', async () => {
    await using sandbox = await testdir();
    const command = [
        process.execPath,
        '-e',
        'for (const path of process.argv.slice(1)) if ((await Bun.file(path).text()).includes("bad")) { console.log(path + ": invalid input"); process.exitCode = 1; }',
        '{files}',
    ];
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            [],
            `[[check]]\nname = "project/content"\nstage = "commit"\npaths = ["*.txt"]\ncommand = ${JSON.stringify(command)}\n[check.output]\nformat = "lines"\n`,
        ),
        '.gspot/version': `${GSPOT_VERSION}\n`,
        'mise.toml': stringify({ tasks: { 'ci:affected': tasks['ci:affected']! } }),
        'changed.txt': 'valid\n',
        'legacy.txt': 'bad\n',
    });
    const commit = () => {
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'Fixture']).code).toBe(0);
        return git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
    };
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    const base = commit();
    writeFileSync(join(sandbox.path, 'changed.txt'), 'bad\n');
    commit();
    writeFileSync(join(sandbox.path, 'changed.txt'), 'working tree correction\n');
    // The task runs gspot from PATH: the package bin, which needs Bun; a runner installs Bun for the repository.
    const environment = {
        MISE_TRUSTED_CONFIG_PATHS: sandbox.path,
        // A runner reaches Bun through a mise shim, which needs a version where no configuration is in scope.
        MISE_BUN_VERSION: Bun.version,
        PATH: [join(root, 'packages/cli/bin'), dirname(process.execPath), toolsPath([])].join(delimiter),
    };
    const argv = ['bash', '-euo', 'pipefail', '-c', step.run!];
    const settings = { cwd: sandbox.path, timeoutMs: 30_000 };
    const failed = await run(argv, { ...settings, env: { ...environment, GSPOT_CI_BASE: base } });
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.stdout, failed.stdout + failed.stderr).toContain('changed.txt');
    expect(failed.stdout).not.toContain('legacy.txt');
    const report = join(sandbox.path, '.gspot/reports/report.json');
    const held = readFileSync(report);
    for (const invalid of ['$(touch injected)', 'f'.repeat(40)]) {
        const refused = await run(argv, { ...settings, env: { ...environment, GSPOT_CI_BASE: invalid } });
        expect(refused.code).toBe(2);
        expect(readFileSync(report)).toStrictEqual(held);
    }
    commit();
    const corrected = await run(argv, { ...settings, env: { ...environment, GSPOT_CI_BASE: base } });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const firstPush = await run(argv, { ...settings, env: { ...environment, GSPOT_CI_BASE: '0'.repeat(40) } });
    expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
    expect(firstPush.stdout).toContain('legacy.txt');
});
