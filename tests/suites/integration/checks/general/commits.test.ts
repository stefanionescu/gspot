import { join, posix } from 'node:path';
import { stringify } from '@decimalturn/toml-patch';
import { LICENSE } from '#tests/config/documents.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { test, expect, describe, beforeAll, beforeEach } from 'bun:test';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { COMMITLINT_PACKAGE } from '#tests/config/authored-config-files.ts';
import { runGspot, spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    COMMIT_MESSAGES,
    COMMITLINT_LEVEL_RESULTS,
    UNTYPED_MESSAGE_FINDINGS,
} from '#tests/config/integration/checks/general/commits.ts';

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

test('commitlint accepts exact folder-name scopes or no scope, reports bad messages, and runs only at level all', async () => {
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

    await applyThenInstall(sandbox.path);
    const draft = join(sandbox.path, 'draft.txt');
    const command = ['check', '--only', 'commits/commitlint', '--json', '--hook', 'commit-msg', '--', draft];
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
    const configured = await spawnGspot(sandbox.path, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await writeFile(draft, `fix(Core): ${'x'.repeat(35)}\n`);
    await assertDraftCheck(sandbox.path, draft, ['header-max-length']);
    for (const message of ['fix(Core): repair source', 'fix: repair source']) {
        await writeFile(draft, `${message}\n`);
        await assertDraftCheck(sandbox.path, draft);
    }
    for (const level of ['basic', 'all', 'basic'] as const) {
        const switched = await spawnGspot(sandbox.path, ['set', 'level', level]);
        expect(switched.code, switched.stdout + switched.stderr).toBe(0);
        const exists = await isOnDisk(join(sandbox.path, getManifestTarget('commits', 'commitlint.json')));
        expect(exists).toBe(level === 'all');
        const checked = await spawnGspot(sandbox.path, command);
        const expected = COMMITLINT_LEVEL_RESULTS[level];
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.code);
        expect(JSON.parse(checked.stdout)).toMatchObject(expected.output);
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

function prepareHookRepository(): void {
    const { root } = installedSandbox();
    runGitStep(root, ['add', '-A']);
    runGitStep(root, ['commit', '-qm', 'chore: configure checks', '--no-verify']);
    runGitStep(root, ['tag', 'configured']);
}

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
        expect(range.report.checks[0]!.findings.map(({ rule, message }) => ({ rule, message }))).toStrictEqual(
            UNTYPED_MESSAGE_FINDINGS.map(({ rule, message }) => ({ rule, message: `${pushed}: ${message}` })),
        );
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
        const report = JSON.parse(rejected.stdout) as PushReport;
        expect(report.revisions.map(({ hash, commits }) => ({ hash, commits }))).toStrictEqual([
            { hash: good, commits: [good] },
            { hash: bad, commits: [bad] },
        ]);
        expect(
            report.revisions[1]!.report.checks[0]!.findings.map(({ rule, message }) => ({ rule, message })),
        ).toStrictEqual(UNTYPED_MESSAGE_FINDINGS.map(({ rule, message }) => ({ rule, message: `${bad}: ${message}` })));
        expect(report.revisions[1]!.report.checks[0]!.note).toBe('Checked 1 commit message.');
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

test.each(['', 'app'])(
    'commitlint reads the generated config through the package.json field gspot writes, in %s',
    async (scope) => {
        const packageFile = posix.join(scope, 'package.json');
        const messageFile = posix.join(scope, 'message.txt');
        await using sandbox = await createGitSandbox({
            [packageFile]: COMMITLINT_PACKAGE,
            [messageFile]: 'special: authored contract\n',
        });
        commitAll(sandbox.path);
        const execution = { cwd: join(sandbox.path, scope), env: {} };
        const command = [join(toolModules, '.bin/commitlint'), '--edit', join(sandbox.path, messageFile)];
        const before = await runCommand(command, execution);
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const initialized = await runGspot(sandbox.path, ['init', '--yes', '--no-configurations', '--level', 'all']);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const target = `${scope === '' ? './' : '../'}${getManifestTarget('commits', 'commitlint.json')}`;
        expect(await readFile(join(sandbox.path, packageFile), 'utf8')).toBe(
            COMMITLINT_PACKAGE.replace('{"rules":{"type-enum":[2,"always",["special"]]}}', () =>
                JSON.stringify({ extends: target }),
            ),
        );
        const mismatched = await runCommand(command, execution);
        expect(mismatched.code, mismatched.stdout + mismatched.stderr).toBe(1);
        expect(mismatched.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
        for (const level of ['basic', 'all']) {
            const changed = await runGspot(sandbox.path, ['set', 'level', level]);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
            const packageText = await readFile(join(sandbox.path, packageFile), 'utf8');
            const expected = Object.fromEntries(
                Object.entries(parseJsonFile('package.json', COMMITLINT_PACKAGE)).filter(
                    ([key]) => key !== 'commitlint',
                ),
            );
            expect(JSON.parse(packageText)).toStrictEqual(expected);
            const generatedConfig = join(sandbox.path, getManifestTarget('commits', 'commitlint.json'));
            expect(await isOnDisk(generatedConfig)).toBe(level === 'all');
            if (level !== 'all') continue;
            const native = await runCommand([...command, '--config', generatedConfig], execution);
            expect(native.code, native.stdout + native.stderr).toBe(1);
            expect(native.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
        }
        await writeFile(join(sandbox.path, messageFile), 'fix: generated contract\n');
        const corrected = await runCommand(
            [...command, '--config', join(sandbox.path, getManifestTarget('commits', 'commitlint.json'))],
            execution,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
