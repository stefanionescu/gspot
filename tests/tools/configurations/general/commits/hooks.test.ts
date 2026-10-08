// The commits configuration: the commit-msg hook refuses a message outside the convention and passes one inside it.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { LICENSE } from '#tests/config/samples/docs.ts';
import { quoteArgument } from '#cli/platform/contracts.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { test, expect, afterAll, describe, beforeAll, beforeEach } from 'bun:test';
import { buildToolsPath, buildSandboxPath, installToolProjects } from '#tests/harness/install.ts';

import {
    COMMITS_SETUP,
    COMMIT_MESSAGES,
    DERIVED_SCOPE_POLICY,
} from '#tests/config/tools/configurations/general/commits/hooks.ts';

// Completed history includes every selected commit and passes its range check.
function expectCompleteHistory(output: string, commits: string[]): void {
    const report = JSON.parse(output) as PushReport;
    expect(report.revisions[0]?.historyComplete).toBe(true);
    expect(new Set(report.revisions[0]?.commits)).toStrictEqual(new Set(commits));
    expect(report.revisions[0]?.report.checks[0]?.status).toBe('passed');
}

// Every message scenario asserts the public native exit and diagnostic contract.
async function expectDraftCheck(root: string, draft: string, rule?: string): Promise<void> {
    const checked = await spawnGspot(root, [
        'check',
        '--only',
        'commits/commitlint',
        '--message-file',
        draft,
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(rule === undefined ? 0 : 1);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'commits/commitlint',
            status: rule === undefined ? 'passed' : 'failed',
            findings: rule === undefined ? [] : [containing({ rule })],
        },
    ]);
}

test('native commitlint keeps exact project scopes optional and restores coverage across level changes', async () => {
    await using sandbox = await testdir();
    const policyPath = join(sandbox.path, 'gspot.toml');
    const policy = buildPolicy([], { level: 'all', tables: DERIVED_SCOPE_POLICY });
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'Packages/Core/source.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const draft = join(sandbox.path, 'draft.txt');
    const command = ['check', '--only', 'commits/commitlint', '--message-file', draft, '--json'];
    for (const { message, rule } of COMMIT_MESSAGES) {
        await Bun.write(draft, `${message}\n`);
        await expectDraftCheck(sandbox.path, draft, rule);
    }
    await Bun.write(
        policyPath,
        `${policy}\n[tools.commitlint.rules]\nheader-max-length = ["always", 40]\nscope-case = ["always", "lower-case"]\nscope-empty = ["never"]\nconstructor = ["always"]\n`,
    );
    const configured = await spawnGspot(sandbox.path, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await Bun.write(draft, `fix(Core): ${'x'.repeat(35)}\n`);
    await expectDraftCheck(sandbox.path, draft, 'header-max-length');
    for (const message of ['fix(Core): repair source', 'fix: repair source']) {
        await Bun.write(draft, `${message}\n`);
        await expectDraftCheck(sandbox.path, draft);
    }
    for (const level of ['recommended', 'all', 'recommended']) {
        const switched = await spawnGspot(sandbox.path, ['set', 'level', level]);
        expect(switched.code, switched.stdout + switched.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, '.gspot/config/commitlint.config.cjs')).exists()).toBe(
            level === 'all',
        );
        const checked = await spawnGspot(sandbox.path, command);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.checks).toMatchObject(
            level === 'all' ? [{ check: 'commits/commitlint', status: 'passed', findings: [] }] : [],
        );
        expect(report.skips).toStrictEqual([]);
    }
});

let sandbox: Awaited<ReturnType<typeof testdir>>;
let root: string;
const environment = { NO_COLOR: '1', PATH: buildSandboxPath(['commitlint']) };
let initial: string;

const prepareCommits = async () => {
    sandbox = await testdir();
    root = sandbox.path;
    await createFileTree(root, { 'scripts/a.sh': CLEAN_BASH_SCRIPT, 'README.md': '# Test\n', LICENSE });
    commitAll(root);
    for (const command of COMMITS_SETUP) {
        const prepared = await spawnGspot(root, command);
        expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    }
    gitOutput(root, ['add', '-A']);
    gitOutput(root, ['commit', '-qm', 'chore: configure checks', '--no-verify']);
    initial = gitOutput(root, ['rev-parse', 'HEAD']);
};

const checkCommitHook = async () => {
    await Bun.write(join(root, 'notes.md'), '# Notes\n');
    expect(git(root, ['add', '-A']).code).toBe(0);
    const bad = git(root, ['commit', '-qm', 'Added notes.'], environment);
    expect(bad.code).not.toBe(0);
    expect(`${bad.stdout}${bad.stderr}`).toContain('type-empty');
    // The reproduction quotes the path, which holds backslashes on Windows.
    expect(bad.stdout + bad.stderr).toContain(`--message-file ${quoteArgument(join(root, '.git/COMMIT_EDITMSG'))}`);
    expect(bad.stdout + bad.stderr).toContain('Bypass this hook once: git commit --no-verify');
    const good = git(root, ['commit', '-qm', 'docs: add the notes page'], environment);
    expect(good.code, good.stdout + good.stderr).toBe(0);
};

const checkMessageFile = async () => {
    const draft = join(root, 'draft.txt');
    await Bun.write(draft, 'Fixed stuff.\n');
    const refused = await spawnGspot(
        root,
        ['check', '--only', 'commits/commitlint', '--message-file', draft, '--json'],
        environment,
    );
    expect(refused.code).toBe(1);
    expect((JSON.parse(refused.stdout) as RunReport).checks).toMatchObject([
        { check: 'commits/commitlint', status: 'failed' },
    ]);
    expect((JSON.parse(refused.stdout) as RunReport).checks[0]?.findings.map(({ rule }) => rule)).toStrictEqual([
        'type-empty',
        'subject-empty',
        'subject-full-stop',
    ]);
};

const checkBypassedHook = async () => {
    const accepted = await spawnGspot(root, ['check', '--only', 'commits/commitlint-pushed'], environment);
    expect(accepted.code).toBe(0);
    await Bun.write(join(root, 'more.md'), '# More\n');
    expect(git(root, ['add', '-A']).code).toBe(0);
    expect(git(root, ['commit', '-qm', 'Pushed past the hook.', '--no-verify']).code).toBe(0);
    const range = await spawnGspot(root, ['check', '--only', 'commits/commitlint-pushed'], environment);
    expect(range.code).toBe(1);
    expect(range.stdout).toContain('type-empty');
};

const checkDistinctMessages = async () => {
    const base = gitOutput(root, ['rev-parse', 'HEAD']);
    const tree = gitOutput(root, ['rev-parse', 'HEAD^{tree}']);
    const good = gitOutput(root, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']);
    const bad = gitOutput(root, ['commit-tree', tree, '-p', base, '-m', 'Bad message.']);
    const command = ['check', '--hook', 'pre-push', '--only', 'commits/commitlint-pushed', '--json'];
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
    expect(gitOutput(root, ['rev-parse', 'HEAD'])).toBe(base);
};

describe('the commits configuration', () => {
    beforeAll(prepareCommits);
    afterAll(() => sandbox[Symbol.asyncDispose]());
    beforeEach(() => {
        gitOutput(root, ['reset', '--hard', initial]);
        gitOutput(root, ['clean', '-fd']);
    });
    test('the commit-msg hook refuses a free-form message and takes a conventional one', checkCommitHook);
    test('the message-file check refuses a free-form message', checkMessageFile);
    test('the range check rejects a bypassed hook', checkBypassedHook);
    test('a push checks distinct messages with identical trees and changed paths', checkDistinctMessages);
});

test('a shallow push checks source content but refuses incomplete required history until it is fetched', async () => {
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
    await installToolProjects(source);
    expect(git(source, ['add', '-A']).code).toBe(0);
    expect(git(source, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
    const base = gitOutput(source, ['rev-parse', 'HEAD']);
    await Bun.write(join(source, 'source.sh'), 'echo selected\n');
    expect(git(source, ['commit', '-qam', 'feat: select source']).code).toBe(0);
    // A zero object names an absent remote ref and has this repository's object width.
    const [selected, ZERO_SHA] = [gitOutput(source, ['rev-parse', 'HEAD']), '0'.repeat(base.length)] as const;
    expect(git(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']).code).toBe(0);
    const { checkout, command, env, remote, input } = {
        checkout: join(sandbox.path, 'checkout'),
        command: ['check', '--hook', 'pre-push', '--json', '--only'],
        env: { PATH: buildToolsPath(['commitlint']) },
        remote: ['--', 'unseen', 'unused'],
        input: { stdin: `refs/heads/main ${selected} refs/heads/main ${ZERO_SHA}\n` },
    };
    expect(git(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]).code).toBe(0);
    await installToolProjects(checkout);
    const content = await spawnGspot(checkout, [...command, 'bash/bash-syntax', ...remote], env, input);
    expect(content.code, content.stdout + content.stderr).toBe(0);
    expect((JSON.parse(content.stdout) as PushReport).revisions[0]).toMatchObject({
        historyComplete: false,
        report: { checks: [{ status: 'passed' }] },
    });
    const refused = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], env, input);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(
        'Pushed history is incomplete for commits/commitlint-pushed',
    );
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('git fetch --unshallow');
    expect(git(checkout, ['fetch', '--unshallow']).code).toBe(0);
    const completed = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], env, input);
    expect(completed.code, completed.stdout + completed.stderr).toBe(0);
    expectCompleteHistory(completed.stdout, [base, selected]);
    expect(gitOutput(checkout, ['rev-parse', 'HEAD'])).toBe(selected);
    expect(await readFile(join(checkout, 'source.sh'), 'utf8')).toBe('echo selected\n');
});
