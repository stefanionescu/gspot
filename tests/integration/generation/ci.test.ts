import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import type { CiDocument } from '#tests/types/ci.ts';
import { join, dirname, delimiter } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { CLI_BIN, spawnGspot } from '#tests/setup/cli/commands.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { CI_SETTINGS, GITHUB_PIPELINE, GITLAB_PIPELINE } from '#tests/data/generation/ci.ts';

/** Create the CI jobs of one provider and their check settings, before the shared tool install. */
async function prepareCiProject(root: string, provider: 'gitlab' | 'github') {
    runGitStep(root, ['init', '-q']);
    const pipelinePath = provider === 'gitlab' ? '.gitlab-ci.yml' : '.github/workflows/application.yml';
    const pipeline = provider === 'gitlab' ? GITLAB_PIPELINE : GITHUB_PIPELINE;
    const settings = CI_SETTINGS.replace('%PROVIDER%', provider)
        .replace(
            '%SYNTAX_COMMAND%',
            JSON.stringify([
                process.execPath,
                '-e',
                'for (const path of process.argv.slice(1)) { const result = Bun.spawnSync(["bash", "-n", path]); if (result.exitCode !== 0) { console.log(path + ": syntax error"); process.exitCode = 1; } }',
                '{files}',
            ]),
        )
        .replace('%AUDIT_COMMAND%', JSON.stringify([process.execPath, '-e', 'process.exitCode = 0']));
    await createFileTree(root, {
        [pipelinePath]: pipeline,
        'changed.sh': 'echo valid\n',
        'legacy.sh': 'if then\n',
    });
    await writeFile(join(root, 'gspot.toml'), settings);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

/** Commit the installed project, then a change with a shell syntax error. */
async function commitCiChanges(root: string, provider: 'gitlab' | 'github') {
    const base = commitAll(root, 'base');
    await writeFile(join(root, 'changed.sh'), 'if then\n');
    commitAll(root, 'invalid change');
    const workflowPath = provider === 'gitlab' ? '.gitlab/ci/gspot.yml' : '.github/workflows/gspot.yml';
    const generated = Bun.YAML.parse(await readFile(join(root, workflowPath), 'utf8')) as CiDocument;
    return { base, generated };
}

/** A fake mise that runs the source CLI and can refuse to install the npm package. */
async function fakeCiMise(folder: string) {
    const nativeMise = Bun.which('mise')!;
    const failure = join(folder, 'mise-fails');
    await writeScriptCommand(
        folder,
        'mise',
        `
import { existsSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'exec' && args.some((arg) => arg.startsWith('npm:@gspothq/cli@'))) {
    if (existsSync(${JSON.stringify(failure)})) {
        console.error('npm error 404 Not Found - GET https://registry.npmjs.org/@gspothq/cli');
        process.exit(1);
    }
    const separator = args.indexOf('--');
    const child = Bun.spawnSync([process.execPath, ${JSON.stringify(CLI_BIN)}, ...args.slice(separator + 2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
    process.exit(child.exitCode);
}
const env = { ...process.env };
const path = Object.keys(env).find((name) => (process.platform === 'win32' ? name.toUpperCase() : name) === 'PATH');
env[path] = ${JSON.stringify(dirname(nativeMise) + delimiter)} + env[path];
const child = Bun.spawnSync([${JSON.stringify(nativeMise)}, ...args], { env, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(child.exitCode);
`,
    );
    return failure;
}

/** Run the generated CI script with the comparison and artifact variables that the provider documents. */
async function runCiJob(
    root: string,
    generated: CiDocument,
    folder: string,
    comparison: string,
): Promise<ProcessOutput> {
    const script =
        'gspot' in generated
            ? generated.gspot.script
            : generated.jobs['check-linux']!.steps.flatMap((step) => (step.run === undefined ? [] : [step.run]));
    // bash comes from `PATH`: an absolute path puts its folder before the fake mise.
    return await runCommand(['bash', '-e', '-c', script.join('\n')], {
        cwd: root,
        env: {
            PATH: `${folder}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`,
            CI_COMMIT_BEFORE_SHA: comparison,
            CI_MERGE_REQUEST_DIFF_BASE_SHA: '',
            GSPOT_CI_BASE: comparison,
            RUNNER_TEMP: folder,
            GITHUB_PATH: join(folder, 'github-path'),
            NO_COLOR: '1',
        },
    });
}

describe.each(['gitlab', 'github'] as const)('%s CI', (provider) => {
    test('the jobs check the changed files, pass after the fix, and check every file of a first push', async () => {
        await using sandbox = await testdir();
        await prepareCiProject(sandbox.path, provider);
        await using executables = await testdir();
        const { base, generated } = await commitCiChanges(sandbox.path, provider);
        await fakeCiMise(executables.path);
        const invalid = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect(invalid.stdout).toContain('project/syntax');
        expect(invalid.stdout).toContain('changed.sh');
        expect(invalid.stdout).not.toContain('legacy.sh');
        await writeFile(join(sandbox.path, 'changed.sh'), 'echo corrected\n');
        // The fix commits changed.sh alone: a commit of the tool lockfiles that the job installed makes it check every
        // file.
        runGitStep(sandbox.path, ['add', 'changed.sh']);
        runGitStep(sandbox.path, ['commit', '-qm', 'correct syntax']);
        const valid = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        const firstPush = await runCiJob(sandbox.path, generated, executables.path, '0'.repeat(base.length));
        expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
        expect(firstPush.stdout).toContain('legacy.sh');
    });

    test('a malformed or unknown base revision exits 2 without running it, and a failed install fails the job', async () => {
        await using sandbox = await testdir();
        await prepareCiProject(sandbox.path, provider);
        await using executables = await testdir();
        const { base, generated } = await commitCiChanges(sandbox.path, provider);
        const failurePath = await fakeCiMise(executables.path);
        const malformed = await runCiJob(sandbox.path, generated, executables.path, '$(touch injected)');
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(malformed.stderr).toContain('Git merge-base failed for $(touch injected):');
        expect(await isOnDisk(join(sandbox.path, 'injected'))).toBe(false);
        const missing = await runCiJob(sandbox.path, generated, executables.path, 'f'.repeat(base.length));
        expect(missing.code).toBe(2);
        expect(missing.stderr).toBe(
            `Git merge-base failed for ${'f'.repeat(base.length)}: fatal: Not a valid commit name ${'f'.repeat(base.length)}.\n`,
        );
        await writeFile(failurePath, '');
        const refused = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(refused.code).toBe(1);
        expect(refused.stderr).toContain('404 Not Found');
    });
});
