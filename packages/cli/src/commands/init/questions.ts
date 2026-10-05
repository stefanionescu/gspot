import which from 'which';
import { select, confirm } from '@clack/prompts';
import { readText } from '#cli/platform/source.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { readGitSetting } from '#cli/platform/git.ts';
import { getLintJobs } from '#cli/repository/survey.ts';
import { isInteractive } from '#cli/platform/environment.ts';
import type { Tooling } from '#cli/types/repository/inventory.ts';
import type { InitOptions } from '#cli/types/lifecycle/selection.ts';
import type { Choice, InitAnswers } from '#cli/types/commands/init.ts';
import { CI_CHOICES, RUNNER_CHOICES } from '#cli/config/commands/init.ts';

// Flags and --yes answer initialization questions without opening a terminal.
function requireTerminal(question: string, flag: string): void {
    if (isInteractive()) return;
    const instruction =
        flag === '--yes' ? 'Pass --yes to accept the plan.' : `Pass ${flag}, or --yes to accept every default.`;
    throw new GspotError('prompt', `${question} There is no terminal to ask in. ${instruction}`);
}

async function askChoice<T extends string>(
    question: string,
    flag: string,
    choices: Choice<T>[],
    initial: T,
    useDefaults: boolean,
): Promise<T> {
    if (useDefaults) return initial;
    requireTerminal(question, flag);
    const answer = await select<T>({
        message: question,
        options: choices.map(({ value, label, hint }) => ({
            value,
            label,
            ...(hint === undefined ? {} : { hint }),
        })) as Parameters<typeof select<T>>[0]['options'],
        initialValue: initial,
    });
    if (typeof answer === 'symbol') throw new GspotError('prompt', `${question} Cancelled; nothing written.`);
    return answer;
}

function detectCi(root: string, tooling: Tooling): InitAnswers['ci'] | undefined {
    if (tooling.ci.includes('.gitlab-ci.yml')) return 'gitlab';
    if (tooling.ci.some((path) => path.startsWith('.github/workflows/'))) return 'github';
    using files = openRoot(root);
    if (readText(root, '.gitlab-ci.yml') !== undefined) return 'gitlab';
    if (files.stat('.github/workflows')?.isDirectory() === true) return 'github';
    return undefined;
}

function proposeCi(root: string, tooling: Tooling): InitAnswers['ci'] {
    const existing = detectCi(root, tooling);
    if (existing !== undefined) return existing;
    if (tooling.ci.length > 0) return 'none';
    const remote = readGitSetting(root, 'remote.origin.url') ?? '';
    const host = remote.replace(/^(?:https?|ssh):\/\//u, '').replace(/^[^@/]+@/u, '');
    if (/^github\.com[:/]/u.test(host)) return 'github';
    return /^gitlab\.com[:/]/u.test(host) ? 'gitlab' : 'none';
}

/**
 * Asks the init questions that flags left open: hooks, CI, rules, and the task runner.
 * @param root the repository root
 * @param options the init flags
 * @param tooling the configuration files, hooks and runner found
 * @returns the answers
 */
export async function askQuestions(root: string, options: InitOptions, tooling: Tooling): Promise<InitAnswers> {
    const hooks = options.hooks ?? (await askConfirmation('Install Git hooks?', '--no-hooks', true, options.yes));
    const ci =
        options.ci ??
        (getLintJobs(root, tooling.ci).length > 0
            ? 'none'
            : await askChoice('Write a CI workflow?', '--ci', CI_CHOICES, proposeCi(root, tooling), options.yes));
    const rules = options.rules ?? (await askConfirmation('Install the agent rules?', '--no-rules', true, options.yes));
    const runner =
        options.runner ??
        (await askChoice(
            'Task runner?',
            '--no-task',
            RUNNER_CHOICES,
            which.sync('mise', { nothrow: true }) === null ? tooling.runner : 'mise',
            options.yes,
        ));
    return { hooks, ci, rules, runner };
}

/**
 * Asks an initialization confirmation after flags and defaults have been considered.
 * @param question the question shown in a terminal
 * @param flag the flag that answers without a terminal
 * @param defaultAnswer the answer accepted by --yes
 * @param useDefaults whether --yes accepts that answer
 * @returns the accepted answer
 */
export async function askConfirmation(
    question: string,
    flag: string,
    defaultAnswer: boolean,
    useDefaults: boolean,
): Promise<boolean> {
    if (useDefaults) return defaultAnswer;
    requireTerminal(question, flag);
    const answer = await confirm({ message: question, initialValue: defaultAnswer });
    if (typeof answer !== 'boolean') throw new GspotError('prompt', `${question} Cancelled; nothing written.`);
    return answer;
}
