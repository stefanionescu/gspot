// The clack questions, asked only in a terminal and never under --yes.
import { note } from '#cli/output/messages.ts';
import { isCi } from '#cli/platform/environment.ts';
import { GspotError } from '#cli/platform/errors.ts';
import type { Choice } from '#cli/types/commands/commands.ts';
import { select, confirm, multiselect } from '@clack/prompts';

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
    if (!(process.stdin.isTTY && process.stdout.isTTY && !isCi()))
        throw new GspotError(
            'prompt',
            `${question} There is no terminal to ask in. Pass ${flag}, or --yes to take every plan.`,
        );
    const answer = await confirm({ message: question, initialValue: defaultAnswer });
    if (typeof answer !== 'boolean') throw new GspotError('prompt', `${question} Cancelled; nothing written.`);
    return answer;
}

/**
 * One choice from a list.
 * @param question the question.
 * @param flag the flag that answers it without a terminal.
 * @param choices the values with their labels.
 * @param initial the choice --yes takes, and the initial value in the terminal.
 * @param useDefaults whether --yes was given.
 * @returns the chosen value.
 */
export async function askChoice<T extends string>(
    question: string,
    flag: string,
    choices: Choice<T>[],
    initial: T,
    useDefaults: boolean,
): Promise<T> {
    if (useDefaults) return initial;
    if (!(process.stdin.isTTY && process.stdout.isTTY && !isCi()))
        throw new GspotError(
            'prompt',
            `${question} There is no terminal to ask in. Pass ${flag}, or --yes to take every plan.`,
        );
    const options = choices.map((choice) => ({
        value: choice.value,
        label: choice.label,
        ...(choice.hint === undefined ? {} : { hint: choice.hint }),
    })) as Parameters<typeof select<T>>[0]['options'];
    const answer = await select<T>({ message: question, options, initialValue: initial });
    if (typeof answer === 'symbol') throw new GspotError('prompt', `${question} Cancelled; nothing written.`);
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
    if (useDefaults || !(process.stdin.isTTY && process.stdout.isTTY && !isCi())) {
        note(`Selected: ${initial.length === 0 ? 'none' : initial.join(', ')}. Change with ${flag}.`);
        return initial;
    }
    const options = choices.map((choice) => ({
        value: choice.value,
        label: choice.label,
        ...(choice.hint === undefined ? {} : { hint: choice.hint }),
    })) as Parameters<typeof multiselect<T>>[0]['options'];
    const answer = await multiselect<T>({ message: question, options, initialValues: initial, required: false });
    if (typeof answer === 'symbol') throw new GspotError('prompt', `${question} Cancelled; nothing written.`);
    note(`Selected: ${answer.length === 0 ? 'none' : answer.join(', ')}. Change with ${flag}.`);
    return answer;
}
