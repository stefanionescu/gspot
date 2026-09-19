// init: read the repository, propose a policy, print the plan, write it after a yes, install the tools, baseline the findings.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { git } from '#cli/platform/spawn.ts';
import type { Profile } from '#types/profile.ts';
import type { TomlTable } from '#types/config.ts';
import { openSession } from '#cli/run/session.ts';
import { compact } from '#cli/policy/normalize.ts';
import { readProfile } from '#cli/profile/read.ts';
import * as messages from '#cli/policy/messages.ts';
import { isConfirmed } from '#cli/output/prompts.ts';
import { proposeText } from '#cli/policy/propose.ts';
import { applyAll } from '#cli/emit/apply-command.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { initPlanText } from '#cli/output/plan-text.ts';
import { detectionText } from '#cli/output/detection.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { unknownLanguages } from '#cli/presets/detect.ts';
import { newerVersion } from '#cli/doctor/newer-version.ts';
import { selectForInit } from '#cli/lifecycle/selection.ts';
import { workspaceScopes } from '#cli/repository/scopes.ts';
import { note, print, paint } from '#cli/output/messages.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { GSPOT_VERSION, writePin } from '#cli/run/version-pin.ts';
import { pruneToolBaselines } from '#cli/emit/prune-baselines.ts';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { firstRun, firstRunSummary } from '#cli/lifecycle/first-check.ts';
import { askInitQuestions, askPresets } from '#cli/lifecycle/questions.ts';
import { buildInitPlan, buildProposal } from '#cli/lifecycle/init/plan.ts';
import { installTools, updatePackageJson } from '#cli/lifecycle/install-tools.ts';
import { applyBlock, gitignoreBlock, fileText } from '#cli/emit/managed-blocks.ts';
import { hasPolicy, parsePolicyText, PolicyError } from '#cli/policy/read-policy.ts';
import { collectCarried, deleteReplaced, ownedTools, unownedTools } from '#cli/lifecycle/takeover.ts';

import type {
    InitOptions,
    InitPrepared,
    InitInputs,
    InitResult,
    InitSelection,
    TakeoverPlan,
} from '#types/lifecycle.ts';

const ALREADY_INSTALLED =
    'This repository already has a gspot.toml. Run `gspot doctor` to see what changed since the install and the command that applies each change.\n';

// git is the only way back from a takeover, so init starts from a tree with nothing uncommitted.
function assertCleanTree(root: string, options: InitOptions): void {
    if (options.allowDirty || options.isDryRun) return;
    const status = git(root, ['status', '--porcelain']);
    const changed = (status ?? '').split('\n').filter((line) => line.trim() !== '');
    if (changed.length > 0) throw new PolicyError([messages.dirtyTree(changed.length)]);
}

// A profile answers the questions a flag did not: its presets, hooks, workflow, runner and rule files.
function profileAnswers(profile: Profile): Partial<InitOptions> {
    const { tables } = profile;
    const presets = tables.presets ?? [];
    const install = tables.rules?.install;
    return compact({
        presets: presets.length === 0 ? ['none'] : presets,
        hooks: tables.hooks?.tool,
        ci: tables.ci?.provider,
        runner: tables.runner?.surface,
        rules: install === undefined ? undefined : toChoice(install),
    });
}

function toChoice(isInstalled: boolean): 'yes' | 'no' {
    return isInstalled ? 'yes' : 'no';
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
    const repo = await readRepository(root, [], []);
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
    const answers = await askInitQuestions(root, options, tooling);
    const carried = collectCarried(root, tooling, selection.selectedIds);
    const proposal = buildProposal(root, selection, answers, carried);
    const profileTables = options.profile?.tables as TomlTable | undefined;
    const policyText = proposeText(profileTables ? { ...proposal, profileTables } : proposal);
    // The proposal is read the way every later command reads it, before anything is written.
    assertPolicyComplete(parsePolicyText(policyText, 'gspot.toml', root));
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
        policyLines: policyText.split('\n').length,
    });
    return {
        plan,
        policyText,
        runner: answers.runner,
        removed: carried.removed,
    };
}

async function write(
    root: string,
    options: InitOptions,
    prepared: InitPrepared,
): Promise<{ lines: string[]; first: Awaited<ReturnType<typeof firstRun>>; installNote: string; failing: number }> {
    writeFileSync(join(root, 'gspot.toml'), prepared.policyText);
    writePin(root, GSPOT_VERSION);
    writeFileSync(join(root, '.gitignore'), applyBlock(fileText(root, '.gitignore'), gitignoreBlock(), 'hash'));
    const opened = await openSession(root);
    await updatePackageJson(
        root,
        prepared.runner,
        opened.scopes.flatMap((scope) => scope.selected),
    );
    const session = await openSession(root);
    const synced = await applyAll(session);
    const installNote = await installTools(root, prepared.runner, synced, options.install);
    const first = await firstRun(root);
    const rendered = new Set([...synced.written, ...synced.unchanged]);
    deleteReplaced(
        root,
        prepared.removed.filter((entry) => !rendered.has(entry.path)),
    );
    // The replaced files are gone from the file set now, so the render that names source files is taken once more,
    // and a tool that keeps its own baseline drops what it recorded for them.
    const after = await openSession(root);
    await applyAll(after);
    await pruneToolBaselines(after);
    const summary = firstRunSummary(first, installNote);
    const newer = await newerVersion(GSPOT_VERSION);
    const { dim } = paint();
    const version =
        newer === undefined ? `gspot ${GSPOT_VERSION}` : `gspot ${newer} is available: gspot upgrade --check`;
    return { lines: [...summary.lines, dim(version), ''], first, installNote, failing: summary.failing };
}

/**
 * Runs init: detection, questions, plan, then the write, the install and the first run after a yes.
 * @param options the init flags
 * @returns the text, the JSON record and the exit code
 */
export async function initCommand(options: InitOptions): Promise<InitResult> {
    const root = findRoot(options.cwd);
    if (hasPolicy(root)) return { text: ALREADY_INSTALLED, json: { error: 'already-installed' }, exitCode: 2 };
    assertCleanTree(root, options);
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
    const isGo = await isConfirmed('Continue?', '--yes', true, options.yes);
    if (!isGo) return { text: 'Nothing written.\n', json: { root, plan, written: false }, exitCode: 0 };
    const written = await write(root, options, prepared);
    note('run gspot check to see the gate; gspot doctor for what it could not check');
    const checks = written.first.record.checks.map((check) => ({
        id: check.id,
        status: check.status,
        findings: check.findings.length,
    }));
    return {
        text: written.lines.join('\n'),
        json: {
            root,
            plan,
            policy: policyText,
            baselines: written.first.baselines,
            install: written.installNote,
            checks,
        },
        exitCode: written.failing > 0 ? 1 : 0,
    };
}
