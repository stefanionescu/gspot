import which from 'which';
import { posix } from 'node:path';
import { select, confirm } from '@clack/prompts';
import { colors } from '#cli/terminal/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { setKey } from '#cli/policy/document/contracts.ts';
import { prepareToolProjects } from '#cli/tools/public.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { readGitSetting } from '#cli/platform/git/public.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { HOOK_RUNNERS } from '#cli/config/generation/hooks.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { installTools } from '#cli/lifecycle/install/public.ts';
import { openRoot, readText } from '#cli/platform/root/public.ts';
import { getLintJobs } from '#cli/repository/discovery/public.ts';
import { projectBuildSettings } from '#cli/parsers/tool/public.ts';
import { emitAll, generatedPaths } from '#cli/generation/public.ts';
import { GspotError, isInteractive } from '#cli/platform/public.ts';
import { selectForScope } from '#cli/repository/selection/public.ts';
import { XCODE_PROJECT_FILE } from '#cli/config/checks/tool/xcode.ts';
import { emitPolicy, writePolicyFile } from '#cli/policy/document/public.ts';
import type { Tooling, Repository } from '#cli/types/repository/inventory.ts';
import { applyPlans, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import type { InitOptions, InitSelection } from '#cli/types/lifecycle/selection.ts';
import { planRetirement, planReplacement } from '#cli/lifecycle/ownership/contracts.ts';

import type {
    Choice,
    Written,
    InitAnswers,
    PolicyDraft,
    InitPrepared,
    RetirementResult,
} from '#cli/types/commands/init.ts';
import {
    PREFACE,
    CI_CHOICES,
    SCHEMA_LINE,
    TEMPLATE_HEAD,
    RUNNER_CHOICES,
    XCODE_DESTINATIONS,
} from '#cli/config/commands/init.ts';

// Deletes the replaced files the plan lists, which Git keeps, and retains directories.
function retireReplaced(
    log: Log,
    removed: InitPrepared['removed'],
    read: ReadonlyMap<string, FileCopy | undefined>,
): RetirementResult {
    const result: RetirementResult = { removed: [], preserved: [] };
    const plans = [];
    for (const entry of removed) {
        if (entry.path.endsWith('/')) {
            result.preserved.push(entry.path);
            continue;
        }
        const expected = read.get(entry.path);
        if (expected === undefined)
            throw new GspotError('policy', [`No original file was recorded for ${entry.path}. Run gspot init again.`]);
        const plan = planRetirement(log, entry.path, expected);
        plans.push(plan);
        const status = plan.status;
        if (status === 'changed') result.removed.push(entry.path);
        else if (status === 'preserved') result.preserved.push(entry.path);
    }
    applyPlans(
        log,
        plans.filter((plan) => plan.status !== 'preserved'),
    );
    return result;
}

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
        options: choices,
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

async function planCi(root: string, tooling: Tooling, useDefaults: boolean): Promise<InitAnswers['ci']> {
    if (getLintJobs(root, tooling.ci).length > 0) return 'none';
    const existing = detectCi(root, tooling);
    const remote =
        existing === undefined && tooling.ci.length === 0 ? (readGitSetting(root, 'remote.origin.url') ?? '') : '';
    const host = remote.replace(/^(?:https?|ssh):\/\//u, '').replace(/^[^@/]+@/u, '');
    const provider = CI_CHOICES.find(
        ({ value }) => host.startsWith(`${value}.com:`) || host.startsWith(`${value}.com/`),
    );
    const proposed = existing ?? provider?.value ?? 'none';
    return await askChoice('Write a CI workflow?', '--ci', CI_CHOICES, proposed, useDefaults);
}

function headTables(
    draft: PolicyDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    formats: Map<string, TomlTable>,
): TomlTable {
    const selection = {
        configurations: draft.configurations,
        removed_configurations: [],
        scope: Object.fromEntries(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
    const swift = draft.template?.tables.swift;
    const project = swift?.xcode_project;
    const destinations = new Map(
        swift?.xcode_destination === undefined && project !== ''
            ? ['', ...draft.scopes.map((entry) => entry.path)].flatMap((scope) => {
                  if (
                      !selectForScope(selection, scope, manifests).some((entry) => entry.configuration.name === 'swift')
                  )
                      return [];
                  const file =
                      project === undefined
                          ? repository.files.find(
                                (entry) =>
                                    entry.path.endsWith(XCODE_PROJECT_FILE) &&
                                    scopeOf(entry.path, draft.scopes).path === scope,
                            )?.path
                          : posix.join(project, 'project.pbxproj');
                  const text = file === undefined ? undefined : readText(repository.root, file);
                  const sdk = text === undefined ? undefined : projectBuildSettings(text).sdkRoot;
                  const destination = XCODE_DESTINATIONS.get(sdk);
                  if (destination === undefined) return [];
                  return [
                      [scope, { swift: { ...(scope === '' ? swift : {}), xcode_destination: destination } }] as const,
                  ];
              })
            : [],
    );
    return {
        ...Object.fromEntries(
            (draft.template === undefined ? [] : Object.entries(draft.template.tables)).filter(
                ([key]) => !TEMPLATE_HEAD.has(key),
            ),
        ),
        configurations: draft.configurations,
        ...destinations.get(''),
        ...formats.get(''),
        ...(draft.scopes.length === 0
            ? {}
            : {
                  scope: Object.fromEntries(
                      draft.scopes.map(({ path, configurations }) => [
                          path,
                          { configurations, ...destinations.get(path), ...formats.get(path) },
                      ]),
                  ),
              }),
    };
}

// Writes the hooks, CI, agent rules, and runner tables from the answers.
function applyIntegrations(document: TomlTable, draft: PolicyDraft): void {
    for (const [key, value] of Object.entries({ hooks: draft.hooks, ci: draft.ci })) {
        if (value === false || value === 'none') Reflect.deleteProperty(document, key);
    }
    if (draft.hooks) setKey(document, 'hooks.enabled', true);
    if (draft.ci !== 'none') setKey(document, 'ci.provider', draft.ci);
    setKey(document, 'agent_rules.enabled', draft.agentRules);
    if (draft.runner === 'none') delete document['runner'];
    else document['runner'] = draft.runner;
}

/**
 * Writes policy and generated files, retires replaced tool files, and installs tools.
 * @param root the repository root
 * @param options whether initialization installs the tools
 * @param prepared what init prepared
 * @returns the lines to print, the installation note, and the exit code
 */
export async function writeSetup(
    root: string,
    options: Pick<InitOptions, 'install'>,
    prepared: InitPrepared,
): Promise<Written> {
    using log = openOwnership(root);
    const session = await openSession(root, {
        policy: parseStrictPolicy(prepared.policyText, root),
        text: prepared.policyText,
        path: POLICY_FILE,
        errors: [],
    });
    const generated = emitAll(session);
    if (options.install) await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    writePolicyFile({
        text: prepared.policyText,
        original: prepared.read.get(POLICY_FILE),
        publish: (next, expected) =>
            applyPlans(log, [
                {
                    ...planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
                    before: expected,
                },
            ]),
    });
    const destinations = generatedPaths(generated);
    const applied = writeGeneratedFiles(session, generated, log, { reviewedOriginals: prepared.read });
    const retired = retireReplaced(
        log,
        prepared.removed.filter((entry) => !destinations.has(entry.path)),
        prepared.read,
    );
    applied.notes.push(
        ...retired.preserved.map((path) => `kept ${path}: it is a folder, or it changed after init read it`),
    );
    const installed = options.install
        ? await installTools(session, log, generated, { refreshLockfiles: false })
        : { note: 'install skipped; run: gspot install', exitCode: 0 };
    const version = colors.dim(`gspot ${session.version}`);
    return {
        lines: ['written: gspot.toml, .gspot/', ...applied.notes, installed.note, version, ''],
        installNote: installed.note,
        exitCode: installed.exitCode,
    };
}

/**
 * Asks the init questions that flags left open: hooks, CI, rules, and the task runner.
 * @param root the repository root
 * @param options the init flags
 * @param tooling the tool files, hooks and runner found
 * @returns the answers
 */
export async function askQuestions(root: string, options: InitOptions, tooling: Tooling): Promise<InitAnswers> {
    const useDefaults = options.yes || (options.isDryRun && !isInteractive());
    const hooks = options.hooks ?? (await askConfirmation('Install Git hooks?', '--no-hooks', true, useDefaults));
    const ci = options.ci ?? (await planCi(root, tooling, useDefaults));
    const agentRules =
        options.agentRules ?? (await askConfirmation('Write agent rules?', '--no-agent-rules', true, useDefaults));
    const runner =
        options.runner ??
        (await askChoice(
            'Runner?',
            '--no-runner',
            RUNNER_CHOICES.map((choice) =>
                choice.value === 'none'
                    ? choice
                    : { ...choice, label: `${choice.label} (${HOOK_RUNNERS[choice.value].command})` },
            ),
            which.sync('mise', { nothrow: true }) === null ? tooling.runner : 'mise',
            useDefaults,
        ));
    return { hooks, ci, agentRules, runner };
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

/**
 * The gspot.toml text for a policy draft.
 * @param draft policy choices
 * @param repository tracked source files
 * @param manifests available configurations
 * @param formats native per-scope format fields
 * @returns TOML with its schema line and preface
 */
export function proposeText(
    draft: PolicyDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    formats: Map<string, TomlTable>,
): string {
    const document = headTables(draft, repository, manifests, formats);
    if (draft.commitScopes !== undefined && draft.commitScopes.length > 0)
        setKey(document, 'tools.commitlint.scopes', draft.commitScopes);
    applyIntegrations(document, draft);
    const copied =
        draft.template === undefined
            ? ''
            : `# Copied from template ${draft.template.tables.template}, sha256 ${draft.template.digest}.\n`;
    const previous = copied === '' ? PREFACE : `${SCHEMA_LINE}\n${copied}${PREFACE.slice(SCHEMA_LINE.length + 1)}`;
    return emitPolicy(previous + (draft.template?.text ?? ''), document);
}

/**
 * Drafts the repository policy from configuration choices and initialization answers.
 * @param selection the selected configurations and scopes
 * @param answers the integration choices
 * @returns the policy draft
 */
export function draftPolicy(selection: InitSelection, answers: InitAnswers): PolicyDraft {
    const scopes = selection.scopes.filter((scope) => scope.path !== '');
    const commitScopes =
        scopes.length > 0 && selection.selectedIds.has('commits')
            ? [...scopes.map((scope) => scope.name), 'root', 'hooks', 'deps']
            : undefined;
    return {
        configurations: selection.rootIds,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: selection.scopeConfigurations.get(scope.path) ?? [],
        })),
        hooks: answers.hooks,
        ci: answers.ci,
        agentRules: answers.agentRules,
        runner: answers.runner,
        ...(commitScopes === undefined ? {} : { commitScopes }),
    };
}
