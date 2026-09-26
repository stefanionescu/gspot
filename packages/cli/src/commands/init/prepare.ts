// What init proposes before anything is written: the detection, the selection, the policy text, and the plan.
import { print } from '#cli/output/messages.ts';
import * as messages from '#cli/policy/messages.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import { agentFiles } from '#cli/agents/instructions.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { proposedScopes } from '#cli/repository/scopes.ts';
import type { Profile } from '#cli/policy/profiles/read.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { TakeoverPlan } from '#cli/commands/init/plan.ts';
import { detectionText } from '#cli/commands/init/detection.ts';
import { selectForInit } from '#cli/commands/init/selection.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import { unknownLanguages } from '#cli/configurations/detect.ts';
import { detectedSettings } from '#cli/commands/init/settings.ts';
import { proposedRunnerTasks } from '#cli/lifecycle/runner-tasks.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { buildInitPlan, buildProposal } from '#cli/commands/init/plan.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';
import type { CarriedConfiguration } from '#cli/policy/adoption/results.ts';
import { askConfigurations, askInitQuestions } from '#cli/commands/init/questions.ts';
import { assertPolicyComplete, parsePolicyText, PolicyError } from '#cli/policy/read.ts';
import { collectCarried, ownedTools, unownedTools } from '#cli/policy/adoption/collect.ts';
import type { InitAnswers, InitInputs, InitOptions, InitPrepared, InitSelection } from '#cli/commands/init/types.ts';

type Planning = {
    root: string;
    options: InitOptions;
    tooling: ExistingTooling;
    selection: InitSelection;
    everySelected: Manifest[];
    answers: InitAnswers;
    carried: CarriedConfiguration;
};

function assertCleanTree(root: string, options: InitOptions): void {
    if (options.allowDirty || options.isDryRun) return;
    const status = runBlocking(['git', 'status', '--porcelain'], { cwd: root });
    if (status.code !== 0) throw new Error(`Git status failed (exit ${String(status.code)}): ${status.stderr.trim()}`);
    const changed = status.stdout.split('\n').filter((line) => line.trim() !== '');
    if (changed.length > 0) throw new PolicyError([messages.dirtyTree(changed.length)]);
}

function profileLine(profile: Profile, selection: InitSelection): NonNullable<TakeoverPlan['profile']> {
    const detected = selection.rootProposals
        .map((proposal) => proposal.configuration)
        .filter((id) => !selection.selectedIds.has(id));
    return { name: profile.tables.profile, digest: profile.digest, selection: profile.tables.selection, detected };
}

// Asks which configurations to keep, and selects again when the person changed the list.
async function chosenSelection(
    inputs: Omit<InitInputs, 'options'>,
    options: InitOptions,
    detected: InitSelection,
): Promise<InitSelection> {
    if (options.json) return detected;
    const kept = await askConfigurations(options, detected, inputs.manifests);
    if (kept === undefined) return detected;
    const configurations = kept.length === 0 ? ['none'] : kept;
    return selectForInit({ ...inputs, options: { ...options, configurations, isListExact: true } });
}

// Prints what init found, unless the caller reads JSON.
function printDetection(inputs: Omit<InitInputs, 'options'>, detected: InitSelection, tooling: ExistingTooling): void {
    const { repo, manifests } = inputs;
    print(
        detectionText({
            files: repo.files,
            proposals: detected.rootProposals,
            scopes: detected.scopes,
            tooling,
            owned: ownedTools(tooling, detected.selectedIds),
            unowned: unownedTools(tooling, detected.selectedIds),
            unknown: unknownLanguages(repo.files, manifests),
            manifests,
            hasGit: repo.hasGit,
        }),
    );
}

// The policy text the proposal renders to, read back the way every later command reads it.
function policyTextFor(
    planning: Planning,
    settingsProposal: Parameters<typeof proposeText>[0],
): { policyText: string; policy: Policy } {
    const profileTables = planning.options.profile?.tables as TomlTable | undefined;
    const policyText = proposeText(profileTables ? { ...settingsProposal, profileTables } : settingsProposal);
    const policy = parsePolicyText(policyText, 'gspot.toml', planning.root);
    assertPolicyComplete({ policy, text: policyText, path: 'gspot.toml' });
    return { policyText, policy };
}

// The plan init prints, built from the policy the proposal parsed to.
function planFor(planning: Planning, policy: Policy, policyText: string): TakeoverPlan {
    const { root, options, tooling, selection, everySelected, answers, carried } = planning;
    return buildInitPlan({
        root,
        tooling,
        everySelected,
        how: selection.how,
        ...(options.profile ? { profile: profileLine(options.profile, selection) } : {}),
        answers,
        ...(policy.runner?.tasks === undefined ? {} : { runnerTasks: policy.runner.tasks }),
        carried,
        agents: policy.rules.install ? agentFiles(root, policy.rules.agents) : [],
        policyLines: policyText.split('\n').length,
    });
}

/**
 * Reads the repository, asks the questions, and builds the plan init shows before writing.
 * @param root the repository root
 * @param options the init options, with a profile's answers folded in
 * @returns the plan, the policy text, and what the takeover observed
 */
export async function prepare(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = configurationManifests();
    const runtime = readOwnership(root)
        .files.filter((entry) => entry.kind === 'runtime')
        .map((entry) => entry.path);
    const repo = await readRepository(root, [], [], [], new Set(runtime));
    if (repo.hasGit) assertCleanTree(root, options);
    const facts = readManifests(root, repo.files);
    const workspace = proposedScopes(root, repo.files, facts, manifests.values());
    const inputs = { root, repo, facts, workspace: workspace.scopes, manifests };
    const detected = selectForInit({ ...inputs, options });
    const tooling = existingTooling(root, repo.files, facts);
    if (!options.json) printDetection(inputs, detected, tooling);
    const selection = await chosenSelection(inputs, options, detected);
    const sources = repo.files.filter((file) => file.nature === 'source').map((file) => file.path);
    const carried = await collectCarried(root, tooling, selection.selectedIds, sources);
    const answers = await askInitQuestions(root, options, tooling, carried.formatter);
    const tasks = proposedRunnerTasks(root, answers.runner);
    const everySelected = [...selection.selectedIds]
        .map((id) => manifests.get(id))
        .filter((manifest) => manifest !== undefined);
    const planning: Planning = { root, options, tooling, selection, everySelected, answers, carried };
    const settings = detectedSettings(everySelected, facts, repo.files);
    const proposal = { ...buildProposal(root, selection, answers, carried, settings), runnerTasks: tasks.names };
    const { policyText, policy } = policyTextFor(planning, proposal);
    return {
        plan: planFor(planning, policy, policyText),
        policyText,
        runner: answers.runner,
        removed: carried.removed,
        observed: new Map([...carried.observed, ...tasks.observed]),
    };
}
