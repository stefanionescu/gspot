import which from 'which';
import { posix } from 'node:path';
import { colors } from '#cli/terminal/public.ts';
import { select, confirm } from '@clack/prompts';
import { openSession } from '#cli/commands/public.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { prepareToolProjects } from '#cli/tools/public.ts';
import { setKey } from '#cli/policy/document/contracts.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { readGitSetting } from '#cli/platform/git/public.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { installTools } from '#cli/lifecycle/install/public.ts';
import { getLintJobs } from '#cli/repository/discovery/public.ts';
import { openRoot, readText } from '#cli/platform/root/public.ts';
import { projectBuildSettings } from '#cli/parsers/tool/public.ts';
import { GspotError, isInteractive } from '#cli/platform/public.ts';
import { emitAll, generatedPaths } from '#cli/generation/public.ts';
import type { InitOptions } from '#cli/types/lifecycle/selection.ts';
import { XCODE_PROJECT_FILE } from '#cli/config/checks/tool/xcode.ts';
import { selectForScope } from '#cli/configurations/selection/public.ts';
import { emitPolicy, writePolicyFile } from '#cli/policy/document/public.ts';
import type { Tooling, Repository } from '#cli/types/repository/inventory.ts';
import { planRetirement, planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import { applyPlan, applyPlans, openOwnership } from '#cli/lifecycle/ownership/public.ts';

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

function planCi(root: string, tooling: Tooling): InitAnswers['ci'] {
    const existing = detectCi(root, tooling);
    if (existing !== undefined) return existing;
    if (tooling.ci.length > 0) return 'none';
    const remote = readGitSetting(root, 'remote.origin.url') ?? '';
    const host = remote.replace(/^(?:https?|ssh):\/\//u, '').replace(/^[^@/]+@/u, '');
    if (/^github\.com[:/]/u.test(host)) return 'github';
    return /^gitlab\.com[:/]/u.test(host) ? 'gitlab' : 'none';
}

function headTables(draft: PolicyDraft, repository: Repository, manifests: Map<string, Manifest>): TomlTable {
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
                  return destination === undefined
                      ? []
                      : [
                            [
                                scope,
                                { swift: { ...(scope === '' ? swift : {}), xcode_destination: destination } },
                            ] as const,
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
        ...(draft.scopes.length === 0
            ? {}
            : {
                  scope: Object.fromEntries(
                      draft.scopes.map(({ path, configurations }) => [
                          path,
                          { configurations, ...destinations.get(path) },
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
 * Writes the policy and the generated files, retires the replaced configuration, and installs the tools.
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
    if (options.install) {
        await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    }
    writePolicyFile({
        files: log.files,
        text: prepared.policyText,
        original: prepared.read.get(POLICY_FILE),
        publish: (next, expected) => {
            applyPlan(log, {
                ...planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
                before: expected,
            });
        },
    });
    const destinations = generatedPaths(generated);
    const applied = writeGeneratedFiles(session, log, prepared.read, generated);
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
 * @param tooling the configuration files, hooks and runner found
 * @returns the answers
 */
export async function askQuestions(root: string, options: InitOptions, tooling: Tooling): Promise<InitAnswers> {
    const hooks = options.hooks ?? (await askConfirmation('Install Git hooks?', '--no-hooks', true, options.yes));
    const ci =
        options.ci ??
        (getLintJobs(root, tooling.ci).length > 0
            ? 'none'
            : await askChoice('Write a CI workflow?', '--ci', CI_CHOICES, planCi(root, tooling), options.yes));
    const agentRules =
        options.agentRules ?? (await askConfirmation('Write agent rules?', '--no-agent-rules', true, options.yes));
    const runner =
        options.runner ??
        (await askChoice(
            'Task runner?',
            '--no-task',
            RUNNER_CHOICES,
            which.sync('mise', { nothrow: true }) === null ? tooling.runner : 'mise',
            options.yes,
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
 * @param draft the policy choices
 * @param repository the tracked files and canonical source root
 * @param manifests the available configuration declarations
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(draft: PolicyDraft, repository: Repository, manifests: Map<string, Manifest>): string {
    const document = headTables(draft, repository, manifests);
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
