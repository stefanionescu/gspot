import * as clack from '@clack/prompts';
import { rejects } from 'node:assert/strict';
import { describe, expect, spyOn, test } from 'bun:test';
import * as environment from '#cli/platform/environment.ts';
import { askConfirmation, PromptError } from '#cli/output/prompts.ts';

function mockTerminal(isTerminal: boolean): () => void {
    const streams = [process.stdin, process.stdout].map((stream) => ({
        stream,
        descriptor: Object.getOwnPropertyDescriptor(stream, 'isTTY'),
    }));
    for (const { stream } of streams) Object.defineProperty(stream, 'isTTY', { configurable: true, value: isTerminal });
    const ci = spyOn(environment, 'isCi').mockReturnValue(false);
    return () => {
        for (const { stream, descriptor } of streams) {
            if (descriptor === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', descriptor);
        }
        ci.mockRestore();
    };
}

describe('confirmation prompts', () => {
    test.each([true, false])('uses the proposed answer %s without opening a prompt', async (defaultAnswer) => {
        const restoreTerminal = mockTerminal(false);
        const confirmation = spyOn(clack, 'confirm').mockResolvedValue(!defaultAnswer);
        try {
            expect(await askConfirmation('Continue?', '--continue', defaultAnswer, true)).toBe(defaultAnswer);
            expect(confirmation).not.toHaveBeenCalled();
        } finally {
            confirmation.mockRestore();
            restoreTerminal();
        }
    });

    test.each([true, false])('returns the explicit answer %s from the terminal', async (answer) => {
        const restoreTerminal = mockTerminal(true);
        const confirmation = spyOn(clack, 'confirm').mockResolvedValue(answer);
        try {
            expect(await askConfirmation('Continue?', '--continue', !answer, false)).toBe(answer);
            expect(confirmation).toHaveBeenCalledWith({ message: 'Continue?', initialValue: !answer });
        } finally {
            confirmation.mockRestore();
            restoreTerminal();
        }
    });

    test('refuses an unanswered confirmation without a terminal', async () => {
        const restoreTerminal = mockTerminal(false);
        const confirmation = spyOn(clack, 'confirm').mockResolvedValue(true);
        try {
            await rejects(askConfirmation('Continue?', '--continue', true, false), {
                name: 'PromptError',
                message: /Pass --continue/u,
            });
            expect(confirmation).not.toHaveBeenCalled();
        } finally {
            confirmation.mockRestore();
            restoreTerminal();
        }
    });

    test('reports cancellation instead of accepting the default', async () => {
        const restoreTerminal = mockTerminal(true);
        const confirmation = spyOn(clack, 'confirm').mockResolvedValue(Symbol('cancel'));
        try {
            await rejects(askConfirmation('Continue?', '--continue', true, false), PromptError);
            expect(confirmation).toHaveBeenCalledTimes(1);
        } finally {
            confirmation.mockRestore();
            restoreTerminal();
        }
    });
});
