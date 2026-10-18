import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import { test, expect, describe, beforeAll, beforeEach } from 'bun:test';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';
import { COMMITS_FILES, COMMIT_MESSAGES } from '#tests/data/checks/commits.ts';
import { buildSandboxPath, installToolProjects } from '#tests/setup/install.ts';

async function assertDraftCheck(
    root: string,
    draft: string,
    rules: string[] = [],
    environment?: Parameters<typeof spawnGspot>[2],
): Promise<void> {
    const checked = await spawnGspot(
        root,
        ['check', '--only', 'commits/commitlint', '--json', '--hook', 'commit-msg', '--', draft],
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
    const settings = buildSettingsText([], {
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

    await installToolProjects(sandbox.path);
    const draft = join(sandbox.path, 'draft.txt');
    const command = ['check', '--only', 'commits/commitlint', '--json', '--hook', 'commit-msg', '--', draft];
    for (const { message, rule } of COMMIT_MESSAGES) {
        await Bun.write(draft, `${message}\n`);
        await assertDraftCheck(sandbox.path, draft, rule === undefined ? [] : [rule]);
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
    await assertDraftCheck(sandbox.path, draft, ['header-max-length']);
    for (const message of ['fix(Core): repair source', 'fix: repair source']) {
        await Bun.write(draft, `${message}\n`);
        await assertDraftCheck(sandbox.path, draft);
    }
    for (const level of ['recommended', 'all', 'recommended']) {
        const switched = await spawnGspot(sandbox.path, ['set', 'level', level]);
        expect(switched.code, switched.stdout + switched.stderr).toBe(0);
        expect(
            await Bun.file(join(sandbox.path, '.gspot/configurations/general/commits/commitlint.json')).exists(),
        ).toBe(level === 'all');
        const checked = await spawnGspot(sandbox.path, command);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.checks).toMatchObject(
            level === 'all' ? [{ check: 'commits/commitlint', status: 'passed', findings: [] }] : [],
        );
        expect(report.skips).toStrictEqual([]);
    }
});

const installedSandbox = registerSharedSandbox({ configurations: ['commits'], level: 'all', files: COMMITS_FILES });

describe('a repository with the commit hooks installed', () => {
    beforeAll(prepareHookRepository);
    beforeEach(() => {
        const { root } = installedSandbox();
        readGitOutput(root, ['reset', '--hard', 'configured']);
        readGitOutput(root, ['clean', '-fd']);
    });
    test('commits/commitlint-pushed reports a commit made past the hook', async () => {
        const { root, environment } = installedSandbox();
        const accepted = await spawnGspot(root, ['check', '--only', 'commits/commitlint-pushed'], environment);
        expect(accepted.code).toBe(0);
        await Bun.write(join(root, 'more.md'), '# More\n');
        expect(runGit(root, ['add', '-A']).code).toBe(0);
        expect(runGit(root, ['commit', '-qm', 'Pushed past the hook.', '--no-verify']).code).toBe(0);
        const range = await spawnGspot(root, ['check', '--only', 'commits/commitlint-pushed'], environment);
        expect(range.code).toBe(1);
        expect(range.stdout).toContain('type-empty');
    });
    test('the pre-push check reads every pushed commit message, even when the trees are equal', async () => {
        const { root, environment } = installedSandbox();
        const base = readGitOutput(root, ['rev-parse', 'HEAD']);
        const tree = readGitOutput(root, ['rev-parse', 'HEAD^{tree}']);
        const good = readGitOutput(root, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']);
        const bad = readGitOutput(root, ['commit-tree', tree, '-p', base, '-m', 'Bad message.']);
        const command = ['check', '--hook', 'pre-push', '--only', 'commits/commitlint-pushed', '--json'];
        const rejected = await spawnGspot(root, command, environment, {
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/bad ${bad} refs/heads/bad ${base}\n`,
        });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = JSON.parse(rejected.stdout) as PushReport;
        expect(report.revisions.map(({ hash, commits }) => ({ hash, commits }))).toStrictEqual([
            { hash: good, commits: [good] },
            { hash: bad, commits: [bad] },
        ]);
        expect(
            report.revisions[1]?.report.checks[0]?.findings.some(
                (finding) => finding.rule === 'type-empty' && finding.message.includes(bad),
            ),
        ).toBe(true);
        const corrected = await spawnGspot(root, command, environment, {
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(readGitOutput(root, ['rev-parse', 'HEAD'])).toBe(base);
    });
});

test('a shallow push checks source content but refuses incomplete required history until it is fetched', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');

    await createFileTree(source, {
        'gspot.toml': buildSettingsText(['bash', 'commits'], { tables: BASH_SYNTAX_CHECK, level: 'all' }),
        'source.sh': 'echo base\n',
    });
    expect(runGit(source, ['init', '-q']).code).toBe(0);

    await installToolProjects(source);
    expect(runGit(source, ['add', '-A']).code).toBe(0);
    expect(runGit(source, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
    const base = readGitOutput(source, ['rev-parse', 'HEAD']);
    await Bun.write(join(source, 'source.sh'), 'echo selected\n');
    expect(runGit(source, ['commit', '-qam', 'feat: select source']).code).toBe(0);
    const [selected, ZERO_SHA] = [readGitOutput(source, ['rev-parse', 'HEAD']), '0'.repeat(base.length)] as const;
    expect(runGit(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']).code).toBe(0);
    const { checkout, command, env, remote, input } = {
        checkout: join(sandbox.path, 'checkout'),
        command: ['check', '--hook', 'pre-push', '--json', '--only'],
        env: { PATH: buildSandboxPath() },
        remote: ['--', 'unseen', 'unused'],
        input: { stdin: `refs/heads/main ${selected} refs/heads/main ${ZERO_SHA}\n` },
    };
    expect(runGit(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]).code).toBe(0);
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
    expect(runGit(checkout, ['fetch', '--unshallow']).code).toBe(0);
    const completed = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], env, input);
    expect(completed.code, completed.stdout + completed.stderr).toBe(0);

    const report = JSON.parse(completed.stdout) as PushReport;
    expect(report.revisions[0]).toMatchObject({ historyComplete: true, report: { checks: [{ status: 'passed' }] } });
    expect(new Set(report.revisions[0]?.commits)).toStrictEqual(new Set([base, selected]));

    expect({
        head: readGitOutput(checkout, ['rev-parse', 'HEAD']),
        source: await readFile(join(checkout, 'source.sh'), 'utf8'),
    }).toStrictEqual({ head: selected, source: 'echo selected\n' });
});

/** Commit the installed hooks and tag the commit that each hook case starts from. */
function prepareHookRepository(): void {
    const { root } = installedSandbox();
    readGitOutput(root, ['add', '-A']);
    readGitOutput(root, ['commit', '-qm', 'chore: configure checks', '--no-verify']);
    readGitOutput(root, ['tag', 'configured']);
}
