import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { LICENSE } from '#tests/config/setup/configurations.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { pushOutputSchema } from '#tests/schemas/setup.ts';
import { parseCheckReport, runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

const COMMIT_MESSAGES = [
    { message: 'fix(Core): repair the parser', rule: undefined },
    { message: 'fix: repair the parser', rule: undefined },
    { message: 'feat(Core)!: drop the parser option', rule: undefined },
    { message: 'fix(core): repair the parser', rule: 'scope-enum' },
] as const;

const UNTYPED_MESSAGE_RULES = ['type-empty', 'subject-empty', 'subject-full-stop'] as const;

async function assertDraftCheck(root: string, draft: string, rules: string[] = []): Promise<void> {
    const checked = parseCheckReport(
        await spawnGspot(root, [
            'check',
            '--only',
            'commits/commitlint',
            '--json',
            '--hook',
            'commit-msg',
            '--',
            draft,
        ]),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(rules.length === 0 ? 0 : 1);
    expect(checked.report.checks).toMatchObject([
        { check: 'commits/commitlint', status: rules.length === 0 ? 'passed' : 'failed' },
    ]);
    expect(checked.report.checks[0]!.findings.map(({ rule }) => rule)).toStrictEqual(rules);
}

function prepareHookRepository(): void {
    const { root } = installedSandbox();
    runGitStep(root, ['add', '-A']);
    runGitStep(root, ['commit', '-qm', 'chore: configure checks', '--no-verify']);
    runGitStep(root, ['tag', 'configured']);
}

test('commitlint accepts exact folder-name scopes or no scope and reports bad messages', async () => {
    const settings = buildSandboxSettings([], {
        level: 'all',
        scopes: [{ path: 'Packages/Core', configurations: [] }],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'Packages/Core/source.sh': CLEAN_BASH_SCRIPT,
    });
    const settingsPath = join(sandbox.path, 'gspot.toml');
    commitAll(sandbox.path);

    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const draft = join(sandbox.path, 'draft.txt');
    for (const { message, rule } of COMMIT_MESSAGES) {
        await writeFile(draft, `${message}\n`);
        await assertDraftCheck(sandbox.path, draft, rule === undefined ? [] : [rule]);
    }
    await writeFile(
        settingsPath,
        settings +
            stringify({
                tools: {
                    commitlint: {
                        rules: { 'header-max-length': ['always', 40] },
                    },
                },
            }),
    );
    await applyGeneratedFiles(sandbox.path);
    await writeFile(draft, `fix(Core): ${'x'.repeat(35)}\n`);
    await assertDraftCheck(sandbox.path, draft, ['header-max-length']);
    for (const message of ['fix(Core): repair source', 'fix: repair source']) {
        await writeFile(draft, `${message}\n`);
        await assertDraftCheck(sandbox.path, draft);
    }
});

const installedSandbox = shareInstalledSandbox({
    configurations: ['commits'],
    level: 'all',
    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'README.md': '# Test\n',
        LICENSE,
    },
});

describe('a repository with the commit hooks installed', () => {
    beforeAll(prepareHookRepository);

    beforeEach(() => {
        const { root } = installedSandbox();
        runGitStep(root, ['reset', '--hard', 'configured']);
        runGitStep(root, ['clean', '-fd']);
    });

    test('commits/commitlint-pushed reports a commit made past the hook', async () => {
        const { root } = installedSandbox();
        const command = ['check', '--only', 'commits/commitlint-pushed', '--json'];
        const accepted = await spawnGspot(root, command);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        await writeFile(join(root, 'more.md'), '# More\n');
        runGitStep(root, ['add', '-A']);
        runGitStep(root, ['commit', '-qm', 'Pushed past the hook.', '--no-verify']);
        const pushed = runGitStep(root, ['rev-parse', 'HEAD']);
        const range = parseCheckReport(await spawnGspot(root, command));
        expect(range.code, range.stdout + range.stderr).toBe(1);
        const { findings } = range.report.checks[0]!;
        expect(findings.map(({ rule }) => rule)).toStrictEqual([...UNTYPED_MESSAGE_RULES]);
        expect(findings.filter(({ message }) => !message.startsWith(`${pushed}: `))).toStrictEqual([]);
    });

    test('the pre-push check reads every pushed commit message, even when the trees are equal', async () => {
        const { root } = installedSandbox();
        const base = runGitStep(root, ['rev-parse', 'HEAD']);
        const tree = runGitStep(root, ['rev-parse', 'HEAD^{tree}']);
        const good = runGitStep(root, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']);
        const bad = runGitStep(root, ['commit-tree', tree, '-p', base, '-m', 'Bad message.']);
        const command = ['check', '--hook', 'pre-push', '--only', 'commits/commitlint-pushed', '--json'];
        const rejected = await spawnGspot(
            root,
            command,
            {},
            {
                stdin: `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/bad ${bad} refs/heads/bad ${base}\n`,
            },
        );
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = pushOutputSchema.parse(JSON.parse(rejected.stdout));
        expect(report.revisions.map(({ hash, commits }) => ({ hash, commits }))).toStrictEqual([
            { hash: good, commits: [good] },
            { hash: bad, commits: [bad] },
        ]);
        const { findings } = report.revisions[1]!.report.checks[0]!;
        expect(findings.map(({ rule }) => rule)).toStrictEqual([...UNTYPED_MESSAGE_RULES]);
        expect(findings.filter(({ message }) => !message.startsWith(`${bad}: `))).toStrictEqual([]);
        expect(report.revisions[1]!.report.checks[0]!.note).toMatch(/\b1\b/u);
        const corrected = await spawnGspot(
            root,
            command,
            {},
            { stdin: `refs/heads/good ${good} refs/heads/good ${base}\n` },
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(runGitStep(root, ['rev-parse', 'HEAD'])).toBe(base);
    });
});
