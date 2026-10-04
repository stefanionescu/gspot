import which from 'which';
import { testdir } from 'testdirs';
import * as clack from '@clack/prompts';
import { readRepository } from '#cli/repository/read.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildInitOptions } from '#tests/harness/init.ts';
import { configureOutput } from '#cli/output/messages.ts';
import { rejection } from '#tests/harness/expectations.ts';
import * as environment from '#cli/platform/environment.ts';
import { selectForInit } from '#cli/lifecycle/selection.ts';
import { EMPTY_TOOLING } from '#tests/config/harness/tooling.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { RUNNER_ANSWERS, RUNNER_FAILURES } from '#tests/config/cli/commands/init/questions.ts';
import { askQuestions, askConfirmation, askConfigurations } from '#cli/commands/init/questions.ts';

/** Read an exact initial selection before asking which configurations the person keeps. */
async function readConfigurationSelection(root: string) {
    const manifests = configurationManifests();
    const options = buildInitOptions(root, { yes: false });
    const selection = selectForInit({
        root,
        repo: await readRepository(root, [], [], []),
        fields: [],
        workspace: [],
        manifests,
        options: { ...options, configurations: ['bash', 'markdown'], isListExact: true },
    });
    return { options, selection, manifests };
}

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
    resources.use(spyOn(clack, 'select').mockResolvedValue(answer));
    const options = buildInitOptions(directory.path, { yes: defaults });
    delete options.runner;
    expect(await askQuestions(directory.path, options, EMPTY_TOOLING)).toStrictEqual({
        hooks: false,
        ci: 'none',
        rules: false,
        runner: expected,
    });
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

test('configuration selection reports its accepted defaults without a terminal', async () => {
    await using directory = await testdir();
    const { options, selection, manifests } = await readConfigurationSelection(directory.path);
    using resources = new DisposableStack();
    resources.use(spyOn(environment, 'isInteractive').mockReturnValue(false));
    using prompt = spyOn(clack, 'multiselect').mockResolvedValue(['different']);
    const lines: string[] = [];
    resources.use(spyOn(process.stderr, 'write').mockImplementation((chunk) => lines.push(String(chunk)) > 0));
    configureOutput({ quiet: false, json: false, color: false });
    expect(await askConfigurations(options, selection, manifests)).toBeUndefined();
    expect(prompt).not.toHaveBeenCalled();
    expect(lines.join('')).toContain('bash');
    expect(lines.join('')).toContain('markdown');
    expect(lines.join('')).toContain('--configurations <ids>');
});

test.each([
    { answer: ['markdown'], text: 'markdown' },
    { answer: [], text: 'none' },
])('configuration selection reports the terminal answer $text', async ({ answer, text }) => {
    await using directory = await testdir();
    const { options, selection, manifests } = await readConfigurationSelection(directory.path);
    using resources = new DisposableStack();
    resources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
    resources.use(spyOn(clack, 'multiselect').mockResolvedValue([...answer]));
    const lines: string[] = [];
    resources.use(spyOn(process.stderr, 'write').mockImplementation((chunk) => lines.push(String(chunk)) > 0));
    configureOutput({ quiet: false, json: false, color: false });
    expect(await askConfigurations(options, selection, manifests)).toStrictEqual([...answer]);
    expect(lines.join('')).toContain(text);
    expect(lines.join('')).toContain('--configurations <ids>');
});

test('configuration selection refuses cancellation before any answer is accepted', async () => {
    await using directory = await testdir();
    const { options, selection, manifests } = await readConfigurationSelection(directory.path);
    using resources = new DisposableStack();
    resources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
    resources.use(spyOn(clack, 'multiselect').mockResolvedValue(Symbol('cancel')));
    expect(await rejection(askConfigurations(options, selection, manifests))).toContain('Cancelled; nothing written.');
});
