// What init proposes before anything is written: the detection, the selection, the policy text, and the plan.
import { print } from '#cli/output/messages.ts';
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { unknownLanguages } from '#cli/kits/detect.ts';
import { readRepository } from '#cli/repository/tree.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { proposedScopes } from '#cli/repository/scopes.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { detectionText } from '#cli/commands/init/detection.ts';
import { selectForInit } from '#cli/commands/init/selection.ts';
import { plan, buildInitPlan } from '#cli/commands/init/plan/build.ts';
import { replacedConfiguration } from '#cli/commands/init/replaced.ts';
import { askKits, askInitQuestions } from '#cli/commands/init/questions.ts';
import { parsePolicyText, assertPolicyComplete } from '#cli/policy/read.ts';
import { isOwned, existingTooling } from '#cli/repository/existing-tooling.ts';
import type { TomlTable, ExistingTooling } from '#cli/types/repository/repository.ts';
import type { Planning, InitInputs, InitOptions, InitPrepared, InitSelection } from '#cli/types/commands.ts';

function assertCleanTree(root: string, options: InitOptions): void {
    if (options.isDryRun) return;
    const status = runBlocking(['git', 'status', '--porcelain'], { cwd: root });
    if (status.code !== 0) throw new Error(`Git status failed (exit ${String(status.code)}): ${status.stderr.trim()}`);
    const changed = status.stdout.split('\n').filter((line) => line.trim() !== '');
    if (changed.length > 0) throw new GspotError('policy', [messages.dirtyTree(changed.length)]);
}

// Asks which kits to keep, and selects again when the person changed the list.
async function chosenSelection(
    inputs: Omit<InitInputs, 'options'>,
    options: InitOptions,
    detected: InitSelection,
): Promise<InitSelection> {
    if (options.json) return detected;
    const kept = await askKits(options, detected, inputs.manifests);
    if (kept === undefined) return detected;
    const configurations = kept.length === 0 ? ['none'] : kept;
    return selectForInit({ ...inputs, options: { ...options, kits: configurations, isListExact: true } });
}

// Prints what init found, unless the caller reads JSON.
function printDetection(inputs: Omit<InitInputs, 'options'>, detected: InitSelection, tooling: ExistingTooling): void {
    const { repo, manifests } = inputs;
    const tools = [...new Set(tooling.configs.map((config) => config.tool))].toSorted((a, b) => a.localeCompare(b));
    const owned: string[] = [];
    const unowned: string[] = [];
    for (const tool of tools) (isOwned(tool, detected.selectedIds) ? owned : unowned).push(tool);
    print(
        detectionText({
            files: repo.files,
            plans: detected.rootPlans,
            scopes: detected.scopes,
            tooling,
            owned,
            unowned,
            unknown: unknownLanguages(repo.files, manifests),
            manifests,
            hasGit: repo.hasGit,
        }),
    );
}

// The policy text the plan renders to, read back the way every later command reads it.
function policyTextFor(
    planning: Planning,
    settingsPlan: Parameters<typeof proposeText>[0],
): { policyText: string; policy: Policy } {
    const profileTables = planning.options.profile?.tables as TomlTable | undefined;
    const policyText = proposeText(profileTables ? { ...settingsPlan, profileTables } : settingsPlan);
    const policy = parsePolicyText(policyText, 'gspot.toml', planning.root);
    assertPolicyComplete({ policy, text: policyText, path: 'gspot.toml' });
    return { policyText, policy };
}

/**
 * Reads the repository, asks the questions, and builds the plan init shows before writing.
 * @param root the repository root
 * @param options the init options, with a profile's answers folded in
 * @returns the plan, the policy text, and the files it read
 */
export async function prepare(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = kitManifests();
    const repo = await readRepository(root, [], [], []);
    if (repo.hasGit) assertCleanTree(root, options);
    const fields = readManifests(root, repo.files);
    const workspace = proposedScopes(root, repo.files, fields, manifests.values());
    const inputs = { root, repo, fields, workspace: workspace.scopes, manifests };
    const detected = selectForInit({ ...inputs, options });
    const tooling = existingTooling(root, repo.files, fields);
    if (!options.json) printDetection(inputs, detected, tooling);
    const selection = await chosenSelection(inputs, options, detected);
    const replaced = replacedConfiguration(root, tooling, selection.selectedIds);
    const answers = await askInitQuestions(root, options, tooling);
    const everySelected = [...selection.selectedIds]
        .map((id) => manifests.get(id))
        .filter((manifest) => manifest !== undefined);
    const planning: Planning = { root, options, tooling, selection, everySelected, answers, replaced };
    const proposed = plan(selection, answers);
    const { policyText, policy } = policyTextFor(planning, proposed);
    return {
        plan: buildInitPlan(planning, policy, policyText),
        policyText,
        runner: answers.runner,
        removed: replaced.removed,
        read: replaced.read,
    };
}
