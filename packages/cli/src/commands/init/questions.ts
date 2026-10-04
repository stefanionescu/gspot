import which from 'which';
import { note } from '#cli/output/messages.ts';
import { readText } from '#cli/platform/source.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { readGitSetting } from '#cli/platform/git.ts';
import { getLintJobs } from '#cli/repository/survey.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { isInteractive } from '#cli/platform/environment.ts';
import { select, confirm, multiselect } from '@clack/prompts';
import type { Tooling } from '#cli/types/repository/inventory.ts';
import type { Choice, InitAnswers } from '#cli/types/commands/init.ts';
import { CI_CHOICES, RUNNER_CHOICES } from '#cli/config/commands/init.ts';
import type { InitOptions, InitSelection } from '#cli/types/lifecycle/selection.ts';

// Flags and --yes answer initialization questions without opening a terminal.
function requireTerminal(question: string, flag: string): void {
    if (isInteractive()) return;
    const instruction =
        flag === '--yes' ? 'Pass --yes to accept the plan.' : `Pass ${flag}, or --yes to accept every default.`;
    throw new GspotError('prompt', `${question} There is no terminal to ask in. ${instruction}`);
}

function toOptions<T extends string>(choices: Choice<T>[]): Parameters<typeof select<T>>[0]['options'] {
    return choices.map(({ value, label, hint }) => ({
        value,
        label,
        ...(hint === undefined ? {} : { hint }),
    })) as Parameters<typeof select<T>>[0]['options'];
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
    const answer = await select<T>({ message: question, options: toOptions(choices), initialValue: initial });
    if (typeof answer === 'symbol') throw new GspotError('prompt', `${question} Cancelled; nothing written.`);
    return answer;
}

async function askChoices<T extends string>(
    question: string,
    flag: string,
    choices: Choice<T>[],
    initial: T[],
): Promise<T[]> {
    if (!isInteractive()) {
        note(`Selected: ${initial.length === 0 ? 'none' : initial.join(', ')}. Change with ${flag}.`);
        return initial;
    }
    const answer = await multiselect<T>({
        message: question,
        options: toOptions(choices),
        initialValues: initial,
        required: false,
    });
    if (typeof answer === 'symbol') throw new GspotError('prompt', `${question} Cancelled; nothing written.`);
    note(`Selected: ${answer.length === 0 ? 'none' : answer.join(', ')}. Change with ${flag}.`);
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
 * Asks which configurations to install: what init selected starts selected, every other shipped configuration is offered.
 * @param options the init flags
 * @param selection what init selected from detection and recommendations
 * @param manifests every configuration manifest
 * @returns the configuration ids the person kept, or undefined when the question was not asked
 */
export async function askConfigurations(
    options: InitOptions,
    selection: InitSelection,
    manifests: Map<string, Manifest>,
): Promise<string[] | undefined> {
    if (options.yes || options.configurations !== undefined || options.template !== undefined) return undefined;
    const choices = manifests
        .values()
        .map((manifest) => {
            const reason = selection.how.get(manifest.configuration.name);
            const hint =
                reason === 'required'
                    ? 'required by another selected configuration'
                    : (reason ?? manifest.configuration.description);
            return { value: manifest.configuration.name, label: manifest.configuration.name, hint };
        })
        .toArray();
    const initial = [...selection.selectedIds];
    const kept = await askChoices('Which configurations?', '--configurations <ids>', choices, initial);
    const isUnchanged = kept.length === initial.length && kept.every((id) => selection.selectedIds.has(id));
    return isUnchanged ? undefined : kept;
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
