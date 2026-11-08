import { chmod, readFile, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { readGitSetting } from '#cli/repository/git/run.ts';
import { installHooks, readHookStatus } from '#cli/tools/installers/hooks.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { HOOK_REPOSITORIES } from '#tests/config/tools/installers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

const PRE_COMMIT_NOTE = `hooks already run from .pre-commit-config.yaml, .git/hooks; add this to the repos of .pre-commit-config.yaml:
  - repo: local
    hooks:
      - id: gspot-pre-commit
        name: gspot pre-commit
        entry: .gspot/hooks/pre-commit
        language: system
        always_run: true
        pass_filenames: false
        stages: [pre-commit]
      - id: gspot-commit-msg
        name: gspot commit-msg
        entry: .gspot/hooks/commit-msg
        language: system
        always_run: true
        stages: [commit-msg]
Then run pre-commit install --hook-type pre-commit --hook-type commit-msg.
pre-commit keeps the push input from its hooks, so add this line to .git/hooks/pre-push instead:
  .gspot/hooks/pre-push "$@"`;

const LEFTHOOK_NOTE = `hooks already run from lefthook.yml, .git/hooks; add this to lefthook.yml:
  pre-commit:
    commands:
      gspot:
        run: .gspot/hooks/pre-commit
  pre-push:
    commands:
      gspot:
        run: .gspot/hooks/pre-push {0}
        use_stdin: true
  commit-msg:
    commands:
      gspot:
        run: .gspot/hooks/commit-msg {1}`;

async function writeGitHook(root: string, name: string, content: string): Promise<void> {
    await writeFile(join(root, '.git/hooks', name), content);
    await chmod(join(root, '.git/hooks', name), 0o755);
}

test.each([...HOOK_REPOSITORIES])(
    'a repository with $name keeps its hooks, gets the lines to add, and is ready only after both lines',
    async (provider) => {
        await using sandbox = await createGitSandbox({});
        const { files, setting, gitHook } = provider;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([], {
                tables: HOOKS_SETTINGS,
            }),
            ...files,
        });
        if (setting !== undefined) runGitStep(sandbox.path, [...setting]);
        if (gitHook) {
            await writeFile(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
            await chmod(join(sandbox.path, '.git/hooks/pre-commit'), 0o755);
        }
        const authoredPaths = gitHook ? ['.git/hooks/pre-commit'] : Object.keys(files);
        const authored = await Promise.all(
            authoredPaths.map(async (path) => ({ path, content: await readFile(join(sandbox.path, path), 'utf8') })),
        );
        await applyGeneratedFiles(sandbox.path);

        const steps: Array<readonly string[]> = [];
        const session = await openSession(sandbox.path);
        const { note: text } = await installHooks(session, steps);
        expect({ steps, text }).toStrictEqual({
            steps: [],
            text: `hooks already run from ${provider.location}; add these gspot lines to them:\n  pre-commit: .gspot/hooks/pre-commit "$@"\n  pre-push: .gspot/hooks/pre-push "$@"\n  commit-msg: .gspot/hooks/commit-msg "$@"`,
        });

        expect(await readHookStatus(session, session.repository)).toMatchObject({
            ready: false,
            text: `not installed; ${text}`,
        });
        const first = authored.find(({ path }) => path !== 'package.json');
        await writeFile(join(sandbox.path, first!.path), `${first!.content}\n.gspot/hooks/pre-commit\n`);
        expect(await readHookStatus(session, session.repository)).toMatchObject({
            ready: false,
        });
        await writeFile(
            join(sandbox.path, first!.path),
            `${first!.content}\n.gspot/hooks/pre-commit\n.gspot/hooks/pre-push\n.gspot/hooks/commit-msg\n`,
        );
        if (first!.path.endsWith('/pre-commit'))
            for (const hook of ['pre-push', 'commit-msg']) {
                const path = join(sandbox.path, dirname(first!.path), hook);
                await writeFile(path, `.gspot/hooks/${hook}\n`);
                await chmod(path, 0o755);
            }
        expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: true });
    },
);

test.each([['.pre-commit-config.yaml', 'repos: []\n']])(
    'a %s with no hook for Git runs nothing, so install turns the gspot hooks on',
    async (path, content) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
            [path]: content,
        });
        const steps: Array<readonly string[]> = [];
        const session = await openSession(sandbox.path);
        await installHooks(session, steps);
        expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
    },
);

test('simple-git-hooks counts each hook only after its command and its hook for Git are both there', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'package.json':
            '{"simple-git-hooks":{"pre-commit":".gspot/hooks/pre-commit","pre-push":".gspot/hooks/pre-push"}}',
    });
    await writeGitHook(sandbox.path, 'pre-commit', '#!/bin/sh\nexit 0\n');
    await writeGitHook(sandbox.path, 'pre-push', '#!/bin/sh\nexit 0\n');
    const session = await openSession(sandbox.path);
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeFile(
        join(sandbox.path, 'package.json'),
        '{"simple-git-hooks":{"pre-commit":".gspot/hooks/pre-commit","pre-push":".gspot/hooks/pre-push","commit-msg":".gspot/hooks/commit-msg"}}',
    );
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeGitHook(sandbox.path, 'commit-msg', '#!/bin/sh\nexit 0\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({
        ready: true,
        text: 'run from package.json, .git/hooks',
    });
});

test('pre-commit gets a block for its file, and the push hook stays out because pre-commit keeps the push input', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        '.pre-commit-config.yaml': 'repos: []\n',
    });
    await writeGitHook(sandbox.path, 'pre-commit', '#!/bin/sh\nexit 0\n');
    const session = await openSession(sandbox.path);
    const { note } = await installHooks(session, []);
    expect(note).toBe(PRE_COMMIT_NOTE);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
    expect(await readHookStatus(session, session.repository)).toMatchObject({ lines: [PRE_COMMIT_NOTE] });

    await writeFile(
        join(sandbox.path, '.pre-commit-config.yaml'),
        '.gspot/hooks/pre-commit\n.gspot/hooks/pre-push\n.gspot/hooks/commit-msg\n',
    );
    await writeGitHook(sandbox.path, 'pre-push', '#!/bin/sh\nexit 0\n');
    await writeGitHook(sandbox.path, 'commit-msg', '#!/bin/sh\nexit 0\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeGitHook(sandbox.path, 'pre-push', '#!/bin/sh\n.gspot/hooks/pre-push "$@"\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: true });
});

test('Lefthook gets a block that passes the arguments and the push input on', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'lefthook.yml': 'pre-commit:\n',
    });
    await writeGitHook(sandbox.path, 'pre-commit', '#!/bin/sh\nexit 0\n');
    const session = await openSession(sandbox.path);
    const { note } = await installHooks(session, []);
    expect(note).toBe(LEFTHOOK_NOTE);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});

test('hook status ignores commented commands and commands in the wrong hook file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        '.githooks/pre-commit': '# .gspot/hooks/pre-commit\n.gspot/hooks/pre-push\n',
    });
    const session = await openSession(sandbox.path);
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeFile(join(sandbox.path, '.githooks/pre-commit'), '.gspot/hooks/pre-commit\n.gspot/hooks/pre-push\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeFile(join(sandbox.path, '.githooks/pre-push'), '.gspot/hooks/pre-push\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeFile(join(sandbox.path, '.githooks/commit-msg'), '.gspot/hooks/commit-msg\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: true });
});

test('a linked executable Git hook is retained by install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'authored-hook': '#!/bin/sh\nexit 0\n',
    });
    await chmod(join(sandbox.path, 'authored-hook'), 0o755);
    await symlink('../../authored-hook', join(sandbox.path, '.git/hooks/pre-commit'));
    const session = await openSession(sandbox.path);
    const steps: Array<readonly string[]> = [];
    expect(await installHooks(session, steps)).toHaveProperty(
        'note',
        expect.stringContaining('hooks already run from .git/hooks'),
    );
    expect(steps).toStrictEqual([]);
});
