// The commits configuration: the commit-msg hook refuses a message outside the convention and passes one inside it.
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { git } from '#tests/harness/git.ts';
import { join, delimiter } from 'node:path';
import { chmodSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import { gspot, spawnGspot } from '#tests/harness/gspot.ts';
import type { CommandFailureJson } from '#cli/types/output.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { COMMITS_INIT } from '#tests/config/tools/commands/commits.ts';
import { buildToolsPath, installPrivateTools } from '#tests/harness/install.ts';

// The message check refuses a bad message, and a later range check rejects a bypassed hook.
async function expectCommitChecks(root: string, environment: Record<string, string>): Promise<void> {
    const draft = join(root, 'draft.txt');
    await Bun.write(draft, 'Fixed stuff.\n');
    const refused = await spawnGspot(
        root,
        ['check', '--only', 'commits/commitlint', '--message-file', draft],
        environment,
    );
    expect(refused.code).toBe(1);
    expect(refused.stdout).toContain('commits/commitlint');
    const accepted = await spawnGspot(root, ['check', '--only', 'commits/commitlint-range'], environment);
    expect(accepted.code).toBe(0);
    await Bun.write(join(root, 'more.md'), '# more\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'Pushed past the hook.', '--no-verify']);
    const range = await spawnGspot(root, ['check', '--only', 'commits/commitlint-range'], environment);
    expect(range.code).toBe(1);
    expect(range.stdout).toContain('type-empty');
}

// A push checks every distinct commit message even when the pushed trees and changed paths are identical.
async function expectDistinctMessages(root: string, environment: Record<string, string>): Promise<void> {
    const base = git(root, ['rev-parse', 'HEAD']).stdout.trim();
    const tree = git(root, ['rev-parse', 'HEAD^{tree}']).stdout.trim();
    const good = git(root, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']).stdout.trim();
    const bad = git(root, ['commit-tree', tree, '-p', base, '-m', 'Bad message.']).stdout.trim();
    const command = ['check', '--hook', 'pre-push', '--only', 'commits/commitlint-range', '--json'];
    const rejected = await spawnGspot(root, command, environment, {
        stdin: `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/bad ${bad} refs/heads/bad ${base}\n`,
    });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    const report = JSON.parse(rejected.stdout) as PushReport;
    expect(report.revisions).toHaveLength(1);
    expect(new Set(report.revisions[0]?.commits)).toStrictEqual(new Set([good, bad]));
    expect(
        report.revisions[0]?.report.checks[0]?.findings.some(
            (finding) => finding.rule === 'type-empty' && finding.message.includes(bad),
        ),
    ).toBe(true);
    const corrected = await spawnGspot(root, command, environment, {
        stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(git(root, ['rev-parse', 'HEAD']).stdout.trim()).toBe(base);
}

// Completed history includes every selected commit and passes its range check.
function expectCompleteHistory(output: string, commits: string[]): void {
    const report = JSON.parse(output) as PushReport;
    expect(report.revisions[0]?.historyComplete).toBe(true);
    expect(new Set(report.revisions[0]?.commits)).toStrictEqual(new Set(commits));
    expect(report.revisions[0]?.report.checks[0]?.status).toBe('passed');
}

test(
    'the commits configuration > the commit-msg hook refuses a free-form message and takes a conventional one',
    async () => {
        await using sandbox = await testdir();
        await using launcher = await testdir();
        await createFileTree(launcher.path, {
            gspot: `#!/usr/bin/env bun
const child = Bun.spawnSync([process.execPath, ${JSON.stringify(gspot)}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(child.exitCode);
`,
        });
        chmodSync(join(launcher.path, 'gspot'), 0o755);
        await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT, 'README.md': '# test\n' });
        git(sandbox.path, ['init', '-q']);
        git(sandbox.path, ['add', '-A']);
        git(sandbox.path, ['commit', '-qm', 'init']);
        const init = await spawnGspot(sandbox.path, COMMITS_INIT);
        expect(init.code, init.stdout + init.stderr).toBe(0);
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const installed = await spawnGspot(sandbox.path, ['install']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        await Bun.write(join(sandbox.path, 'notes.md'), '# notes\n');
        git(sandbox.path, ['add', '-A']);
        const environment = {
            NO_COLOR: '1',
            PATH: `${launcher.path}${delimiter}${buildToolsPath(['commitlint'])}`,
        };
        const bad = git(sandbox.path, ['commit', '-qm', 'Added notes.'], environment);
        expect(bad.code).not.toBe(0);
        expect(`${bad.stdout}${bad.stderr}`).toContain('type-empty');
        // The reproduction quotes the path, which holds backslashes on Windows.
        expect(bad.stdout + bad.stderr).toContain(
            `--message-file ${quoteArgument(join(sandbox.path, '.git/COMMIT_EDITMSG'))}`,
        );
        expect(bad.stdout + bad.stderr).toContain('Bypass this hook once: git commit --no-verify');
        const good = git(sandbox.path, ['commit', '-qm', 'docs: add the notes page'], environment);
        expect(good.code, good.stdout + good.stderr).toBe(0);
        await expectCommitChecks(sandbox.path, environment);
        await expectDistinctMessages(sandbox.path, environment);
    },
    // The journey installs the private tools, then commits through the hooks.
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'a shallow push checks source content but refuses incomplete required history until it is fetched',
    async () => {
        await using sandbox = await testdir();
        const source = join(sandbox.path, 'source');
        await createFileTree(source, {
            'gspot.toml': buildPolicy(['bash', 'commits'], {
                tables: '[agent_rules]\nenabled = false\n',
                level: 'all',
            }),
            'source.sh': 'echo base\n',
        });
        expect(git(source, ['init', '-q']).code).toBe(0);
        const applied = await spawnGspot(source, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(source);
        expect(git(source, ['add', '-A']).code).toBe(0);
        expect(git(source, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
        const base = git(source, ['rev-parse', 'HEAD']).stdout.trim();
        await Bun.write(join(source, 'source.sh'), 'echo selected\n');
        expect(git(source, ['commit', '-qam', 'feat: select source']).code).toBe(0);
        const selected = git(source, ['rev-parse', 'HEAD']).stdout.trim();
        expect(git(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']).code).toBe(0);
        const checkout = join(sandbox.path, 'checkout');
        await installPrivateTools(checkout);
        const options = {
            command: ['check', '--hook', 'pre-push', '--json', '--only'],
            env: { PATH: buildToolsPath(['commitlint']) },
            stdin: `refs/heads/main ${selected} refs/heads/main ${'0'.repeat(40)}\n`,
        };
        const content = await spawnGspot(checkout, [...options.command, 'bash/syntax'], options.env, {
            stdin: options.stdin,
        });
        expect(content.code, content.stdout + content.stderr).toBe(0);
        expect((JSON.parse(content.stdout) as PushReport).revisions[0]).toMatchObject({
            historyComplete: false,
            report: { checks: [{ status: 'passed' }] },
        });
        const refused = await spawnGspot(checkout, [...options.command, 'commits/commitlint-range'], options.env, {
            stdin: options.stdin,
        });
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(
            'Pushed history is incomplete for commits/commitlint-range',
        );
        expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('git fetch --unshallow');
        expect(git(checkout, ['fetch', '--unshallow']).code).toBe(0);
        const completed = await spawnGspot(checkout, [...options.command, 'commits/commitlint-range'], options.env, {
            stdin: options.stdin,
        });
        expect(completed.code, completed.stdout + completed.stderr).toBe(0);
        expectCompleteHistory(completed.stdout, [base, selected]);
        expect(git(checkout, ['rev-parse', 'HEAD']).stdout.trim()).toBe(selected);
        expect(readFileSync(join(checkout, 'source.sh'), 'utf8')).toBe('echo selected\n');
    },
    // The clone installs the private tools before its three checks.
    NATIVE_TEST_TIMEOUT_MS,
);
