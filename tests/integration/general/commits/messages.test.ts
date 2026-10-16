/** Native preparation commands shared by the four installed commit scenarios. */
// Completed history includes every selected commit and passes its range check.
/** Derived scope names retain the case of project folders; messages may omit a scope. */
/** Native preparation commands shared by the four installed commit scenarios. */
// Completed history includes every selected commit and passes its range check.
/** Derived scope names retain the case of project folders; messages may omit a scope. */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { git, commitAll, gitOutput } from '#tests/setup/git.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { COMMITS_FILES, COMMIT_MESSAGES } from '#tests/config/commitlint.ts';
import { BASH_SYNTAX_CHECK, CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import { test, expect, afterAll, describe, beforeAll, beforeEach } from 'bun:test';
import { toolsPath, sandboxPath, installToolProjects } from '#tests/setup/install.ts';

// Every message scenario asserts the public native exit and diagnostic contract.
async function expectDraftCheck(
    root: string,
    draft: string,
    rules: string[] = [],
    environment?: Parameters<typeof spawnGspot>[2],
): Promise<void> {
    const checked = await spawnGspot(
        root,
        ['check', '--only', 'commits/commitlint', '--message-file', draft, '--json'],
        environment,
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(rules.length === 0 ? 0 : 1);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks).toMatchObject([
        {
            check: 'commits/commitlint',
            status: rules.length === 0 ? 'passed' : 'failed',
        },
    ]);
    expect(report.checks[0]?.findings.map(({ rule }) => rule)).toStrictEqual(rules);
}

test('commitlint accepts exact folder-name scopes or no scope, reports bad messages, and runs only at level all', async () => {
    await using sandbox = await testdir();
    const settingsPath = join(sandbox.path, 'gspot.toml');
    const settings = settingsText([], {
        level: 'all',
        tables: `[[scope]]
path = "Packages/Core"

configurations = []
`,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
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
        await expectDraftCheck(sandbox.path, draft, rule === undefined ? [] : [rule]);
    }
    await Bun.write(
        settingsPath,
        `${settings}
[tools.commitlint.rules]
header-max-length = ["always", 40]
scope-case = ["always", "lower-case"]
`,
    );
    const configured = await spawnGspot(sandbox.path, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await Bun.write(draft, `fix(Core): ${'x'.repeat(35)}\n`);
    await expectDraftCheck(sandbox.path, draft, ['header-max-length']);
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

const environment = { NO_COLOR: '1', PATH: sandboxPath() };

let initial: string;

describe('a repository with the commit hooks installed', () => {
    beforeAll(prepareHookRepository);
    afterAll(() => sandbox[Symbol.asyncDispose]());
    beforeEach(() => {
        gitOutput(root, ['reset', '--hard', initial]);
        gitOutput(root, ['clean', '-fd']);
    });
    test('commits/commitlint-pushed reports a commit made past the hook', async () => {
        const accepted = await spawnGspot(root, ['check', '--only', 'commits/commitlint-pushed'], environment);
        expect(accepted.code).toBe(0);
        await Bun.write(join(root, 'more.md'), '# More\n');
        expect(git(root, ['add', '-A']).code).toBe(0);
        expect(git(root, ['commit', '-qm', 'Pushed past the hook.', '--no-verify']).code).toBe(0);
        const range = await spawnGspot(root, ['check', '--only', 'commits/commitlint-pushed'], environment);
        expect(range.code).toBe(1);
        expect(range.stdout).toContain('type-empty');
    });
    test('the pre-push check reads every pushed commit message, even when the trees are equal', async () => {
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
    });
});

test('a shallow push checks source content but refuses incomplete required history until it is fetched', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');

    await createFileTree(source, {
        'gspot.toml': settingsText(['bash', 'commits'], { tables: BASH_SYNTAX_CHECK, level: 'all' }),
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
    const [selected, ZERO_SHA] = [gitOutput(source, ['rev-parse', 'HEAD']), '0'.repeat(base.length)] as const;
    expect(git(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']).code).toBe(0);
    const { checkout, command, env, remote, input } = {
        checkout: join(sandbox.path, 'checkout'),
        command: ['check', '--hook', 'pre-push', '--json', '--only'],
        env: { PATH: toolsPath() },
        remote: ['--', 'unseen', 'unused'],
        input: { stdin: `refs/heads/main ${selected} refs/heads/main ${ZERO_SHA}\n` },
    };
    expect(git(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]).code).toBe(0);
    await installToolProjects(checkout);
    const content = await spawnGspot(checkout, [...command, 'project/bash-syntax', ...remote], env, input);
    expect(content.code, content.stdout + content.stderr).toBe(0);
    expect((JSON.parse(content.stdout) as PushReport).revisions[0]).toMatchObject({
        historyComplete: false,
        report: { checks: [{ status: 'passed' }] },
    });
    const refused = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], env, input);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toMatch(
        /Pushed history is incomplete for commits\/commitlint-pushed[\s\S]*git fetch --unshallow/u,
    );
    expect(git(checkout, ['fetch', '--unshallow']).code).toBe(0);
    const completed = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], env, input);
    expect(completed.code, completed.stdout + completed.stderr).toBe(0);

    const report = JSON.parse(completed.stdout) as PushReport;
    expect(report.revisions[0]).toMatchObject({ historyComplete: true, report: { checks: [{ status: 'passed' }] } });
    expect(new Set(report.revisions[0]?.commits)).toStrictEqual(new Set([base, selected]));

    expect({
        head: gitOutput(checkout, ['rev-parse', 'HEAD']),
        source: await readFile(join(checkout, 'source.sh'), 'utf8'),
    }).toStrictEqual({ head: selected, source: 'echo selected\n' });
});

/** Install real commit hooks and record the clean state restored between hook cases. */
async function prepareHookRepository(): Promise<void> {
    sandbox = await testdir();
    root = sandbox.path;
    await createFileTree(root, {
        ...COMMITS_FILES,
    });
    commitAll(root);
    for (const command of [buildInitArguments(['commits']), ['set', 'level', 'all'], ['install']]) {
        const prepared = await spawnGspot(root, command);
        expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    }
    gitOutput(root, ['add', '-A']);
    gitOutput(root, ['commit', '-qm', 'chore: configure checks', '--no-verify']);
    initial = gitOutput(root, ['rev-parse', 'HEAD']);
}
