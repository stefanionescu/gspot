import which from 'which';
import { join } from 'node:path';
import * as clack from '@clack/prompts';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as environment from '#cli/platform/public.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildInitOptions } from '#tests/harness/init.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { stat, readdir, readFile } from 'node:fs/promises';
import { runGspot, spawnGspot } from '#tests/harness/gspot.ts';
import { INIT_CI_CASES } from '#tests/config/cli/commands/init/ci.ts';
import { EMPTY_TOOLING } from '#tests/config/cli/commands/init/tooling.ts';
import { askQuestions, askConfirmation } from '#cli/commands/init/contracts.ts';

import {
    RUNNER_ANSWERS,
    RUNNER_OPTIONS,
    DEFAULT_ANSWERS,
    RUNNER_FAILURES,
} from '#tests/config/cli/commands/init/questions.ts';

describe('initialization confirmations', () => {
    test('uses the proposed answer without opening a prompt', async () => {
        using resources = new DisposableStack();
        resources.use(spyOn(environment, 'isInteractive').mockReturnValue(false));
        using confirmation = spyOn(clack, 'confirm').mockResolvedValue(true);
        expect(await askConfirmation('Continue?', '--continue', false, true)).toBe(false);
        expect(confirmation).not.toHaveBeenCalled();
    });

    test.each([true, false])('returns the explicit answer %s from the terminal', async (answer) => {
        using resources = new DisposableStack();
        resources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
        using confirmation = spyOn(clack, 'confirm').mockResolvedValue(answer);
        expect(await askConfirmation('Continue?', '--continue', !answer, false)).toBe(answer);
        expect(confirmation).toHaveBeenCalledWith({ message: 'Continue?', initialValue: !answer });
    });

    test('refuses an unanswered confirmation without a terminal', async () => {
        using resources = new DisposableStack();
        resources.use(spyOn(environment, 'isInteractive').mockReturnValue(false));
        using confirmation = spyOn(clack, 'confirm').mockResolvedValue(true);
        expect(await rejection(askConfirmation('Continue?', '--continue', true, false))).toContain('Pass --continue');
        expect(confirmation).not.toHaveBeenCalled();
    });

    test('reports cancellation instead of accepting the default', async () => {
        using resources = new DisposableStack();
        resources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
        resources.use(spyOn(clack, 'confirm').mockResolvedValue(Symbol('cancel')));
        expect(await rejection(askConfirmation('Continue?', '--continue', true, false))).toContain(
            'Cancelled; nothing written.',
        );
    });
});

test.each([...RUNNER_ANSWERS])('initialization $name', async ({ terminal, defaults, answer, expected }) => {
    await using directory = await testdir();
    using resources = new DisposableStack();
    resources.use(spyOn(environment, 'isInteractive').mockReturnValue(terminal));
    resources.use(spyOn(which, 'sync').mockReturnValue('/provided/mise'));
    const selection = resources.use(spyOn(clack, 'select').mockResolvedValue(answer));
    const options = buildInitOptions(directory.path, { yes: defaults });
    delete options.runner;
    expect(await askQuestions(directory.path, options, EMPTY_TOOLING)).toStrictEqual({
        hooks: false,
        ci: 'none',
        agentRules: false,
        runner: expected,
    });
    if (terminal) expect(selection.mock.calls[0]?.[0]).toMatchObject({ message: 'Runner?', options: RUNNER_OPTIONS });
});

test.each([...RUNNER_FAILURES])('initialization $name', async ({ terminal, answer, error }) => {
    await using directory = await testdir();
    using resources = new DisposableStack();
    resources.use(spyOn(environment, 'isInteractive').mockReturnValue(terminal));
    resources.use(spyOn(which, 'sync').mockReturnValue('/provided/mise'));
    resources.use(spyOn(clack, 'select').mockResolvedValue(answer === 'cancel' ? Symbol('cancel') : answer));
    const options = buildInitOptions(directory.path, { yes: false });
    delete options.runner;
    expect(await rejection(askQuestions(directory.path, options, EMPTY_TOOLING))).toContain(error);
});

test('initialization groups detected test runners and infrastructure under their native categories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"dependencies":{"jest":"30.2.0"}}',
        Dockerfile: 'FROM node:24\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', ...QUIET_INIT]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/^test runners\s+jest\b/mu);
    expect(result.stdout).toMatch(/^infrastructure\s+docker\b/mu);
    expect(result.stdout).not.toMatch(/^tools\s/mu);
});

test('noninteractive dry-run accepts every default and preserves explicit answers', async () => {
    await using directory = await testdir();
    using resources = new DisposableStack();
    resources.use(spyOn(environment, 'isInteractive').mockReturnValue(false));
    resources.use(spyOn(which, 'sync').mockReturnValue('/provided/mise'));
    const confirmation = resources.use(spyOn(clack, 'confirm'));
    const selection = resources.use(spyOn(clack, 'select'));
    const options = buildInitOptions(directory.path, { yes: false, isDryRun: true });
    delete options.hooks;
    delete options.ci;
    delete options.agentRules;
    delete options.runner;
    expect(await askQuestions(directory.path, options, EMPTY_TOOLING)).toStrictEqual(DEFAULT_ANSWERS);
    expect(
        await askQuestions(
            directory.path,
            buildInitOptions(directory.path, { yes: false, isDryRun: true }),
            EMPTY_TOOLING,
        ),
    ).toStrictEqual({ hooks: false, ci: 'none', agentRules: false, runner: 'none' });
    expect(confirmation).not.toHaveBeenCalled();
    expect(selection).not.toHaveBeenCalled();
});

test.each([false, true])('interactive dry-run retains the hooks answer and cancellation %s', async (cancelled) => {
    await using directory = await testdir();
    using resources = new DisposableStack();
    resources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
    const confirmation = resources.use(spyOn(clack, 'confirm').mockResolvedValue(cancelled ? Symbol('cancel') : true));
    const options = buildInitOptions(directory.path, { yes: false, isDryRun: true });
    delete options.hooks;
    if (cancelled)
        expect(await rejection(askQuestions(directory.path, options, EMPTY_TOOLING))).toContain(
            'Install Git hooks? Cancelled; nothing written.',
        );
    else
        expect(await askQuestions(directory.path, options, EMPTY_TOOLING)).toStrictEqual({
            hooks: true,
            ci: 'none',
            agentRules: false,
            runner: 'none',
        });
    expect(confirmation).toHaveBeenCalledWith({ message: 'Install Git hooks?', initialValue: true });
});

test('noninteractive source init dry-run prints a plan without writing and ordinary init still refuses', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    const path = join(sandbox.path, 'README.md');
    const files = await readdir(sandbox.path, { recursive: true });
    files.sort((left, right) => left.localeCompare(right));
    const content = await readFile(path);
    const { mode } = await stat(path);
    const proposed = await spawnGspot(sandbox.path, ['init', '--dry-run', '--no-install']);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    expect(proposed.stdout).toContain('gspot.toml');
    expect(proposed.stderr).not.toContain('There is no terminal to ask in.');
    const proposedFiles = await readdir(sandbox.path, { recursive: true });
    expect(proposedFiles.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(files);
    expect(await readFile(path)).toStrictEqual(content);
    const current = await stat(path);
    expect(current.mode).toBe(mode);
    const refused = await spawnGspot(sandbox.path, ['init', '--no-install']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('Install Git hooks? There is no terminal to ask in. Pass --no-hooks, or --yes');
    const refusedFiles = await readdir(sandbox.path, { recursive: true });
    expect(refusedFiles.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(files);
});

test.each(INIT_CI_CASES)(
    'interactive initialization bypasses a CI prompt for $name and retains explicit providers',
    async ({ path, content }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: content });
        using resources = new DisposableStack();
        resources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
        const selection = resources.use(spyOn(clack, 'select'));
        const options = buildInitOptions(sandbox.path, { yes: false, isDryRun: true });
        delete options.ci;
        const tooling = { ...EMPTY_TOOLING, ci: [path] };
        expect(await askQuestions(sandbox.path, options, tooling)).toStrictEqual({
            hooks: false,
            ci: 'none',
            agentRules: false,
            runner: 'none',
        });
        expect(await askQuestions(sandbox.path, { ...options, ci: 'gitlab' }, tooling)).toStrictEqual({
            hooks: false,
            ci: 'gitlab',
            agentRules: false,
            runner: 'none',
        });
        expect(selection).not.toHaveBeenCalled();
    },
);
