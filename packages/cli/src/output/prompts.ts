// The clack questions, asked only in a terminal and never under --yes.
import { confirm, isCancel, multiselect, select, text } from '@clack/prompts';

export class NoTerminalError extends Error {
    constructor(question: string, flag: string) {
        super(`${question} There is no terminal to ask in. Pass ${flag}, or --yes to take every proposal.`);
        this.name = 'NoTerminalError';
    }
}

/** True when a question can be asked. */
export function canAsk(): boolean {
    return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY) && !process.env['CI'];
}

/** A yes or no question. */
export async function askConfirm(question: string, flag: string, initial: boolean, yes: boolean): Promise<boolean> {
    if (yes) return initial;
    if (!canAsk()) throw new NoTerminalError(question, flag);
    const answer = await confirm({ message: question, initialValue: initial });
    if (isCancel(answer)) process.exit(2);
    return answer as boolean;
}

/** One choice from a list. */
export async function askChoice<T extends string>(
    question: string,
    flag: string,
    choices: { value: T; label: string; hint?: string | undefined }[],
    initial: T,
    yes: boolean,
): Promise<T> {
    if (yes) return initial;
    if (!canAsk()) throw new NoTerminalError(question, flag);
    const answer = await select({
        message: question,
        options: choices.map((choice) => ({
            value: choice.value,
            label: choice.label,
            ...(choice.hint ? { hint: choice.hint } : {}),
        })) as unknown as Parameters<typeof select<T>>[0]['options'],
        initialValue: initial,
    });
    if (isCancel(answer)) process.exit(2);
    return answer as T;
}

/** Several choices from a list. */
export async function askMany<T extends string>(
    question: string,
    flag: string,
    choices: { value: T; label: string; hint?: string | undefined }[],
    initial: T[],
    yes: boolean,
): Promise<T[]> {
    if (yes) return initial;
    if (!canAsk()) throw new NoTerminalError(question, flag);
    const answer = await multiselect({
        message: question,
        options: choices.map((choice) => ({
            value: choice.value,
            label: choice.label,
            ...(choice.hint ? { hint: choice.hint } : {}),
        })) as unknown as Parameters<typeof multiselect<T>>[0]['options'],
        initialValues: initial,
        required: false,
    });
    if (isCancel(answer)) process.exit(2);
    return answer as T[];
}

/** A free-text answer. */
export async function askText(question: string, flag: string, initial: string, yes: boolean): Promise<string> {
    if (yes) return initial;
    if (!canAsk()) throw new NoTerminalError(question, flag);
    const answer = await text({ message: question, initialValue: initial });
    if (isCancel(answer)) process.exit(2);
    return answer as string;
}
