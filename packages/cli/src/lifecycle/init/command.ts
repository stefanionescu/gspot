import { agentFiles } from '#cli/rules/managed-block.ts';
import { InstallationError } from '#cli/lifecycle/install-error.ts';
// init: read the repository, propose a policy, print the plan, write it after a yes, install the tools.
import { isDeepStrictEqual } from 'node:util';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { Profile } from '#cli/profile/types.ts';
import type { TomlTable } from '#cli/policy/types.ts';
import { openSession } from '#cli/run/session.ts';
import { compact } from '#cli/policy/normalize.ts';
import { readProfile } from '#cli/profile/read.ts';
import * as messages from '#cli/policy/messages.ts';
import { proposeText } from '#cli/policy/propose.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { applyAll } from '#cli/emit/apply-command.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { initPlanText } from '#cli/output/plan-text.ts';
import { askConfirmation } from '#cli/output/prompts.ts';
import { detectionText } from '#cli/output/detection.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { unknownLanguages } from '#cli/presets/detect.ts';
import { selectForInit } from '#cli/lifecycle/selection.ts';
import { workspaceScopes } from '#cli/repository/scopes.ts';
import { note, print, paint } from '#cli/output/messages.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { GSPOT_VERSION, writePin } from '#cli/run/version-pin.ts';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { askInitQuestions, askPresets } from '#cli/lifecycle/questions.ts';
import { buildInitPlan, buildProposal } from '#cli/lifecycle/init/plan.ts';
import { installTools } from '#cli/lifecycle/install-tools.ts';
import { gitignoreBlock } from '#cli/emit/managed-blocks.ts';
import { hasPolicy, parsePolicyText, PolicyError } from '#cli/policy/read-policy.ts';
import { collectCarried, retireReplaced, ownedTools, unownedTools } from '#cli/lifecycle/takeover.ts';

import type {
    InitOptions,
    InitPrepared,
    InitInputs,
    InitResult,
    InitSelection,
    TakeoverPlan,
} from '#cli/lifecycle/types.ts';

const ALREADY_INSTALLED =
    'This repository already has a gspot.toml. Run `gspot doctor` to see what changed since the install and the command that applies each change.\n';

function assertCleanTree(root: string, options: InitOptions): void {
    if (options.allowDirty || options.isDryRun) return;
    const status = runBlocking(['git', 'status', '--porcelain'], { cwd: root });
    if (status.code !== 0) throw new Error(`Git status failed (exit ${String(status.code)}): ${status.stderr.trim()}`);
    const changed = status.stdout.split('\n').filter((line) => line.trim() !== '');
    if (changed.length > 0) throw new PolicyError([messages.dirtyTree(changed.length)]);
}

// A profile answers the questions a flag did not: its presets, hooks, workflow, runner and rule files.
function profileAnswers(profile: Profile): Partial<InitOptions> {
    const { tables } = profile;
    const presets = tables.presets ?? [];
    const install = tables.rules?.install;
    return compact({
        presets: presets.length === 0 ? ['none'] : presets,
        hooks: tables.hooks === undefined ? 'none' : tables.hooks.tool,
        ci: tables.ci === undefined ? 'none' : tables.ci.provider,
        runner: tables.runner === undefined ? 'none' : tables.runner.tool,
        rules: install === undefined ? undefined : install ? 'yes' : 'no',
    });
}

function optionsFromProfile(options: InitOptions, profile: Profile): InitOptions {
    return { ...profileAnswers(profile), ...options, profile };
}

function profileLine(profile: Profile, selection: InitSelection): NonNullable<TakeoverPlan['profile']> {
    const detected = selection.rootProposals
        .map((proposal) => proposal.preset)
        .filter((id) => !selection.selectedIds.has(id));
    return { name: profile.tables.profile, digest: profile.digest, selection: profile.tables.selection, detected };
}

// Asks which presets to keep, and selects again when the person changed the list.
async function chosenSelection(
    inputs: Omit<InitInputs, 'options'>,
    options: InitOptions,
    detected: InitSelection,
): Promise<InitSelection> {
    if (options.json) return detected;
    const kept = await askPresets(options, detected, inputs.manifests);
    if (kept === undefined) return detected;
    const presets = kept.length === 0 ? ['none'] : kept;
    return selectForInit({ ...inputs, options: { ...options, presets, isListExact: true } });
}

async function prepare(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = presetManifests();
    const repo = await readRepository(root, [], [], []);
    if (repo.hasGit) assertCleanTree(root, options);
    const facts = readManifests(root, repo.files);
    const workspace = workspaceScopes(root, facts);
    const inputs = { root, repo, facts, workspace: workspace.scopes, manifests };
    const detected = selectForInit({ ...inputs, options });
    const tooling = existingTooling(root, repo.files, detected.scopes, facts);
    if (!options.json)
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
            }),
        );
    const selection = await chosenSelection(inputs, options, detected);
    const carried = await collectCarried(
        root,
        tooling,
        selection.selectedIds,
        repo.files.filter((file) => file.nature === 'source').map((file) => file.path),
    );
    const answers = await askInitQuestions(root, options, tooling, carried.formatter);
    const proposal = buildProposal(root, selection, answers, carried);
    const profileTables = options.profile?.tables as TomlTable | undefined;
    const policyText = proposeText(profileTables ? { ...proposal, profileTables } : proposal);
    // The proposal is read the way every later command reads it, before anything is written.
    const policy = parsePolicyText(policyText, 'gspot.toml', root);
    assertPolicyComplete(policy);
    const everySelected = [...selection.selectedIds]
        .map((id) => manifests.get(id))
        .filter((manifest) => manifest !== undefined);
    const plan = buildInitPlan({
        root,
        tooling,
        everySelected,
        how: selection.how,
        ...(options.profile ? { profile: profileLine(options.profile, selection) } : {}),
        answers,
        carried,
        agents: policy.rules.install ? agentFiles(root, policy.rules.agents) : [],
        policyLines: policyText.split('\n').length,
    });
    return {
        plan,
        policyText,
        runner: answers.runner,
        removed: carried.removed,
        observed: carried.observed,
    };
}

async function write(
    root: string,
    options: InitOptions,
    prepared: InitPrepared,
): Promise<{ lines: string[]; installNote: string }> {
    return withLifecycleOwner(root, async (owner) => {
        for (const [path, original] of prepared.observed)
            if (!isDeepStrictEqual(owner.read(path), original))
                throw new PolicyError([
                    `Configuration changed after takeover was planned: ${path}. Run gspot init again.`,
                ]);
        const removedPaths = new Set(prepared.removed.map((entry) => entry.path));
        const takeover = new Map([...prepared.observed].filter(([path]) => removedPaths.has(path)));
        owner.replace('gspot.toml', { bytes: Buffer.from(prepared.policyText), mode: 0o644 }, 'policy', true);
        writePin(root, GSPOT_VERSION);
        owner.replaceBlock('.gitignore', gitignoreBlock(), 'hash');
        const session = await openSession(root);
        const outputs = emitAll(session, takeover);
        const generated = new Set(
            [...outputs.files, ...outputs.blocks, ...outputs.merges, ...outputs.packages].map((output) => output.path),
        );
        const synced = await applyAll(session, takeover);
        const retired = retireReplaced(
            root,
            prepared.removed.filter((entry) => !generated.has(entry.path)),
            prepared.observed,
        );
        synced.notes.push(
            ...retired.preserved.map(
                (path) => `retained ${path}: directory contents or subsequent edits are not authorized for deletion`,
            ),
        );
        let installNote: string;
        try {
            installNote = await installTools(session, options.install);
        } catch (error) {
            if (
                !(error instanceof AggregateError) ||
                !error.errors.every(
                    (failure: unknown) => failure instanceof MissingToolError || failure instanceof InstallationError,
                )
            )
                throw error;
            installNote = `${error.message}\nSetup was written; tool installation is incomplete. Run: gspot install`;
        }
        const { dim } = paint();
        const version = `gspot ${GSPOT_VERSION}`;
        return { lines: ['written: gspot.toml, .gspot/', ...synced.notes, installNote, dim(version), ''], installNote };
    });
}

/**
 * Runs init: detection, questions, plan, then writes and installs after acceptance.
 * @param options the init flags
 * @returns the text, the JSON report and the exit code
 */
export async function initCommand(options: InitOptions): Promise<InitResult> {
    const root = findRoot(options.cwd);
    if (hasPolicy(root)) return { text: ALREADY_INSTALLED, json: { error: 'already-installed' }, exitCode: 2 };
    const effective =
        options.from === undefined
            ? options
            : optionsFromProfile(options, await readProfile(options.from, options.cwd));
    const prepared = await prepare(root, effective);
    const { plan, policyText } = prepared;
    if (!options.json) print(initPlanText(plan));
    if (options.isDryRun) {
        if (!options.json) print('--dry-run: nothing written.\n');
        return { text: '', json: { root, plan, policy: policyText, isDryRun: true }, exitCode: 0 };
    }
    if (plan.unread.length > 0)
        return {
            text: 'Cannot apply takeover because configuration could not be read. Fix the listed files and run gspot init again.\n',
            json: { root, plan, error: 'unread-configuration', written: false },
            exitCode: 2,
        };
    const isGo = await askConfirmation('Continue?', '--yes', true, options.yes);
    if (!isGo) return { text: 'Nothing written.\n', json: { root, plan, written: false }, exitCode: 0 };
    const written = await write(root, options, prepared);
    note('run gspot check to check this repository; gspot doctor checks the setup');
    return {
        text: written.lines.join('\n'),
        json: {
            root,
            plan,
            policy: policyText,
            install: written.installNote,
        },
        exitCode: 0,
    };
}
