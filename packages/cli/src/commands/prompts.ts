import { note } from '#cli/output/messages.ts';
import { isCi } from '#cli/platform/environment.ts';
import type { Choice } from '#cli/types/commands/commands.ts';
// The clack questions, asked only in a terminal and never under --yes.
import { confirm, multiselect, select } from '@clack/prompts';

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
 * @param defaultAnswer the answer --yes takes, and the initial value in the terminal
 * @param useDefaults whether --yes was given
 * @returns the answer
 */
export async function askConfirmation(
    question: string,
    flag: string,
    defaultAnswer: boolean,
    useDefaults: boolean,
): Promise<boolean> {
    if (useDefaults) return defaultAnswer;
    if (!canAsk()) throw PromptError.noTerminal(question, flag);
    const answer = await confirm({ message: question, initialValue: defaultAnswer });
    if (typeof answer !== 'boolean') throw PromptError.cancelled(question);
    return answer;
}

/**
 * One choice from a list.
 * @param question the question
 * @param flag the flag that answers it without a terminal
 * @param choices the values with their labels
 * @param initial the choice --yes takes, and the initial value in the terminal
 * @param useDefaults whether --yes was given
 * @returns the chosen value
 */
export async function askChoice<T extends string>(
    question: string,
    flag: string,
    choices: Choice<T>[],
    initial: T,
    useDefaults: boolean,
): Promise<T> {
    if (useDefaults) return initial;
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

/**
 * Several choices from a list. Under --yes, or with no terminal, the initial values stand.
 * @param question the question
 * @param flag the flag that changes the selected list
 * @param choices the values with their labels
 * @param initial the values selected at the start
 * @param useDefaults whether --yes was given
 * @returns the values the person kept
 */
export async function askMany<T extends string>(
    question: string,
    flag: string,
    choices: Choice<T>[],
    initial: T[],
    useDefaults: boolean,
): Promise<T[]> {
    if (useDefaults || !canAsk()) {
        note(`Selected: ${initial.length === 0 ? 'none' : initial.join(', ')}. Change with ${flag}.`);
        return initial;
    }
    const options = choices.map((choice) => ({
        value: choice.value,
        label: choice.label,
        ...(choice.hint === undefined ? {} : { hint: choice.hint }),
    })) as Parameters<typeof multiselect<T>>[0]['options'];
    const answer = await multiselect<T>({ message: question, options, initialValues: initial, required: false });
    if (typeof answer === 'symbol') throw PromptError.cancelled(question);
    note(`Selected: ${answer.length === 0 ? 'none' : answer.join(', ')}. Change with ${flag}.`);
    return answer;
}
