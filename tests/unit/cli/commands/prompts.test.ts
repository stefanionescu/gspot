import * as clack from '@clack/prompts';
import { rejects } from 'node:assert/strict';
import * as messages from '#cli/output/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import * as environment from '#cli/platform/environment.ts';
import { askChoices, askConfirmation } from '#cli/commands/prompts.ts';

describe('confirmation prompts', () => {
    test('uses the proposed answer without opening a prompt', async () => {
        const terminal = spyOn(environment, 'isInteractive').mockReturnValue(false);
        const confirmation = spyOn(clack, 'confirm').mockResolvedValue(true);
        try {
            expect(await askConfirmation('Continue?', '--continue', false, true)).toBe(false);
            expect(confirmation).not.toHaveBeenCalled();
        } finally {
            confirmation.mockRestore();
            terminal.mockRestore();
        }
    });

    test.each([true, false])('returns the explicit answer %s from the terminal', async (answer) => {
        const terminal = spyOn(environment, 'isInteractive').mockReturnValue(true);
        const confirmation = spyOn(clack, 'confirm').mockResolvedValue(answer);
        try {
            expect(await askConfirmation('Continue?', '--continue', !answer, false)).toBe(answer);
            expect(confirmation).toHaveBeenCalledWith({ message: 'Continue?', initialValue: !answer });
        } finally {
            confirmation.mockRestore();
            terminal.mockRestore();
        }
    });

    test('refuses an unanswered confirmation without a terminal', async () => {
        const terminal = spyOn(environment, 'isInteractive').mockReturnValue(false);
        const confirmation = spyOn(clack, 'confirm').mockResolvedValue(true);
        try {
            await rejects(askConfirmation('Continue?', '--continue', true, false), {
                name: 'GspotError',
                message: /Pass --continue/u,
            });
            expect(confirmation).not.toHaveBeenCalled();
        } finally {
            confirmation.mockRestore();
            terminal.mockRestore();
        }
    });

    test('reports cancellation instead of accepting the default', async () => {
        const terminal = spyOn(environment, 'isInteractive').mockReturnValue(true);
        const confirmation = spyOn(clack, 'confirm').mockResolvedValue(Symbol('cancel'));
        try {
            await rejects(askConfirmation('Continue?', '--continue', true, false), GspotError);
            expect(confirmation).toHaveBeenCalledTimes(1);
        } finally {
            confirmation.mockRestore();
            terminal.mockRestore();
        }
    });
});

test('list selection reports its accepted defaults without a terminal', async () => {
    const terminal = spyOn(environment, 'isInteractive').mockReturnValue(false);
    const selection = spyOn(clack, 'multiselect').mockResolvedValue(['different']);
    const printed = spyOn(messages, 'note').mockImplementation(() => {});
    try {
        expect(await askChoices('Which kits?', '--kits <ids>', [], ['bash', 'markdown'], false)).toStrictEqual([
            'bash',
            'markdown',
        ]);
        expect(selection).not.toHaveBeenCalled();
        expect(printed).toHaveBeenCalledWith('Selected: bash, markdown. Change with --kits <ids>.');
    } finally {
        printed.mockRestore();
        selection.mockRestore();
        terminal.mockRestore();
    }
});

test.each([{ answer: ['markdown'] }, { answer: [] }])(
    'list selection reports the actual terminal answer $answer',
    async ({ answer }) => {
        const terminal = spyOn(environment, 'isInteractive').mockReturnValue(true);
        const selection = spyOn(clack, 'multiselect').mockResolvedValue([...answer]);
        const printed = spyOn(messages, 'note').mockImplementation(() => {});
        try {
            expect(
                await askChoices(
                    'Which kits?',
                    '--kits <ids>',
                    [{ value: 'markdown', label: 'Markdown' }],
                    ['bash'],
                    false,
                ),
            ).toStrictEqual([...answer]);
            expect(printed).toHaveBeenCalledWith(
                `Selected: ${answer.length === 0 ? 'none' : 'markdown'}. Change with --kits <ids>.`,
            );
        } finally {
            printed.mockRestore();
            selection.mockRestore();
            terminal.mockRestore();
        }
    },
);
