import type { Choice } from '#types/output.ts';
// The clack questions, asked only in a terminal and never under --yes.
import { confirm, select } from '@clack/prompts';
import { isCi } from '#cli/platform/environment.ts';

/** Thrown when a question cannot be answered: no terminal to ask in, or the person cancelled. The command exits 2. */
export class PromptError extends Error {
    /**
     * The error for a question with no terminal to be asked in.
     * @param question the question
     * @param flag the flag that answers it
     * @returns the error
     */
    static noTerminal(question: string, flag: string): PromptError {
        return new PromptError(
            `${question} There is no terminal to ask in. Pass ${flag}, or --yes to take every proposal.`,
        );
    }

    /**
     * The error for a cancelled question.
     * @param question the question
     * @returns the error
     */
    static cancelled(question: string): PromptError {
        return new PromptError(`${question} Cancelled; nothing written.`);
    }

    /**
     * Wraps the message.
     * @param text the message
     */
    constructor(text: string) {
        super(text);
        this.name = 'PromptError';
    }
}

/**
 * True when a question can be asked.
 * @returns whether stdin and stdout are terminals outside CI
 */
export function canAsk(): boolean {
    return process.stdin.isTTY && process.stdout.isTTY && !isCi();
}

/**
 * A yes or no question.
 * @param question the question
 * @param flag the flag that answers it without a terminal
 * @param isDefaultYes the answer --yes takes, and the initial value in the terminal
 * @param isYes whether --yes was given
 * @returns the answer
 */
export async function isConfirmed(
    question: string,
    flag: string,
    isDefaultYes: boolean,
    isYes: boolean,
): Promise<boolean> {
    if (isYes) return isDefaultYes;
    if (!canAsk()) throw PromptError.noTerminal(question, flag);
    const answer = await confirm({ message: question, initialValue: isDefaultYes });
    if (typeof answer !== 'boolean') throw PromptError.cancelled(question);
    return answer;
}

/**
 * One choice from a list.
 * @param question the question
 * @param flag the flag that answers it without a terminal
 * @param choices the values with their labels
 * @param initial the choice --yes takes, and the initial value in the terminal
 * @param isYes whether --yes was given
 * @returns the chosen value
 */
export async function askChoice<T extends string>(
    question: string,
    flag: string,
    choices: Choice<T>[],
    initial: T,
    isYes: boolean,
): Promise<T> {
    if (isYes) return initial;
    if (!canAsk()) throw PromptError.noTerminal(question, flag);
    const options = choices.map((choice) => ({
        value: choice.value,
        label: choice.label,
        ...(choice.hint === undefined ? {} : { hint: choice.hint }),
    })) as Parameters<typeof select<T>>[0]['options'];
    const answer = await select<T>({ message: question, options, initialValue: initial });
    if (typeof answer === 'symbol') throw PromptError.cancelled(question);
    return answer;
}
