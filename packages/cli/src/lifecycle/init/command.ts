// init: read the repository, propose a policy, print the plan, write it after a yes, install the tools, baseline the findings.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { git } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/run/session.ts';
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
import { askInitQuestions } from '#cli/lifecycle/questions.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { GSPOT_VERSION, writePin } from '#cli/run/version-pin.ts';
import { hasPolicy, PolicyError } from '#cli/policy/read-policy.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { firstRun, firstRunSummary } from '#cli/lifecycle/first-check.ts';
import { buildInitPlan, buildProposal } from '#cli/lifecycle/init/plan.ts';
import type { InitOptions, InitPrepared, InitResult } from '#types/lifecycle.ts';
import { installTools, updatePackageJson } from '#cli/lifecycle/install-tools.ts';
import { applyBlock, gitignoreBlock, fileText } from '#cli/emit/managed-blocks.ts';
import { collectCarried, deleteReplaced, ownedTools, unownedTools } from '#cli/lifecycle/takeover.ts';

const ALREADY_INSTALLED =
    'This repository already has a gspot.toml. Run `gspot doctor` to see what changed since the install and the command that applies each change.\n';

// git is the only way back from a takeover, so init starts from a tree with nothing uncommitted.
function assertCleanTree(root: string, options: InitOptions): void {
    if (options.allowDirty || options.isDryRun) return;
    const status = git(root, ['status', '--porcelain']);
    const changed = (status ?? '').split('\n').filter((line) => line.trim() !== '');
    if (changed.length > 0) throw new PolicyError([messages.dirtyTree(changed.length)]);
}

async function prepare(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = presetManifests();
    const repo = await readRepository(root, [], []);
    const facts = readManifests(root, repo.files);
    const workspace = workspaceScopes(root, facts);
    const selection = selectForInit({ root, repo, facts, workspace: workspace.scopes, manifests, options });
    const tooling = existingTooling(root, repo.files, selection.scopes, facts);
    const owned = ownedTools(tooling, selection.selectedIds);
    const unowned = unownedTools(tooling, selection.selectedIds);
    const unknown = unknownLanguages(repo.files, manifests);
    const summary = {
        files: repo.files,
        proposals: selection.rootProposals,
        scopes: selection.scopes,
        tooling,
        owned,
        unowned,
        unknown,
        manifests,
    };
    if (!options.json) print(detectionText(summary));
    const answers = await askInitQuestions(root, options, tooling);
    const carried = collectCarried(root, tooling, selection.selectedIds);
    const policyText = proposeText(buildProposal(root, selection, answers, carried));
    const everySelected = [...selection.selectedIds]
        .map((id) => manifests.get(id))
        .filter((manifest) => manifest !== undefined);
    const plan = buildInitPlan({
        root,
        tooling,
        everySelected,
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
    const synced = await applyAll(session, options.binaryPath);
    const installNote = await installTools(root, prepared.runner, synced, options.install);
    const first = await firstRun(root);
    const rendered = new Set([...synced.written, ...synced.unchanged]);
    deleteReplaced(
        root,
        prepared.removed.filter((entry) => !rendered.has(entry.path)),
    );
    // The replaced files are gone from the file set now, so the render that names source files is taken once more.
    await applyAll(await openSession(root), options.binaryPath);
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
    const prepared = await prepare(root, options);
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
