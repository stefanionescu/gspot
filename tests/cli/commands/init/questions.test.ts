import which from 'which';
import { testdir } from 'testdirs';
import * as clack from '@clack/prompts';
import * as environment from '#cli/platform/public.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildInitOptions } from '#tests/harness/init.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { EMPTY_TOOLING } from '#tests/config/harness/tooling.ts';
import { askQuestions, askConfirmation } from '#cli/commands/init/contracts.ts';
import { RUNNER_ANSWERS, RUNNER_OPTIONS, RUNNER_FAILURES } from '#tests/config/cli/commands/init/questions.ts';

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
