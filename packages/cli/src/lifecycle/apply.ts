import { isDeepStrictEqual } from 'node:util';
import { readPolicyFile } from '#cli/policy/file.ts';
import type { Session } from '#cli/types/planning.ts';
import { assertNoProblems } from '#cli/policy/read.ts';
import { removeValePackages } from '#cli/tools/vale.ts';
import { toolProjectDrift } from '#cli/tools/project.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { CONFLICT_MARKERS } from '#cli/config/parsers/git.ts';
import { applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { writeVersionPin } from '#cli/lifecycle/version-pin.ts';
import type { Generated } from '#cli/types/generation/output.ts';
import { emitAll, outputPaths } from '#cli/generation/outputs.ts';
import { proposeClaudeMove } from '#cli/lifecycle/ownership/claude-file.ts';
import { proposeRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import type { ApplyReport, WriteRequest } from '#cli/types/lifecycle/apply.ts';
import { deleteInstallation } from '#cli/lifecycle/ownership/installations.ts';
import { RETAINED_KINDS, RETAINED_PATHS } from '#cli/config/lifecycle/ownership.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { proposeBlock, proposeMerge, proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { VALE_CONFIG, TOOL_PYTHON_PROJECT, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';

// An installation no selected configuration needs any more goes whole, and so do the Vale packages once nothing checks prose.
function pruneInstallations(log: Log, root: string, retained: WriteRequest['retained']): void {
    if (!retained.packages) deleteInstallation(log, 'npm');
    if (!retained.python) deleteInstallation(log, 'python');
    if (!retained.prose) removeValePackages(root);
}

// The text of `CLAUDE.md` lands after the block the batch wrote to `AGENTS.md`, and the file goes.
function moveClaudeFile(log: Log, report: ApplyReport): void {
    const moves = proposeClaudeMove(log);
    applyPlans(log, moves);
    if (moves.length > 0) report.removed.push('CLAUDE.md');
}

/**
 * Writes generated outputs and removes recorded outputs no configuration needs. Every plan is made before the first write.
 * @param log the locked ownership context.
 * @param request generated outputs, pruning policy, and reviewed originals.
 */
function writeGenerated(log: Log, request: WriteRequest): void {
    const { root, generated, report, retained, reviewedOriginals, conflictedOutputs } = request;
    const configurations = generated.configurations.map((output) => {
        const plan = proposeMerge(log, output.path, output.changes, true);
        return reviewedOriginals?.has(output.path) === true
            ? { ...plan, before: reviewedOriginals.get(output.path) }
            : plan;
    });
    const authorized = new Map([...(conflictedOutputs ?? []), ...(reviewedOriginals ?? [])]);
    const replacements = generated.files.map((file) => {
        const kind = file.kind === 'lock' || file.kind === 'hook' ? file.kind : 'config';
        // A reviewed original or a file with merge conflict markers is replaced whatever its bytes are.
        const read = file.kind === 'lock' ? file.read : authorized.get(file.path);
        const replacement = {
            bytes: Buffer.from(file.content),
            mode: file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE,
        };
        const plan = proposeReplacement(log, {
            path: file.path,
            next: replacement,
            kind,
            canReplace: read !== undefined,
            expected: read,
        });
        return authorized.has(file.path) ? { ...plan, before: authorized.get(file.path) } : plan;
    });
    const blocks = generated.blocks.map((block) => proposeBlock(log, block.path, block.block, block.style));
    const generatedPlans = [...replacements, ...blocks, ...configurations];
    // `CLAUDE.md` is no output: it moves into `AGENTS.md` after the batch instead of getting its old text back.
    const expected = new Set([...RETAINED_PATHS, ...outputPaths(generated), 'CLAUDE.md']);
    // Pruning restores only recorded outputs that no selected owner still needs.
    const pruning = log.state.files
        .filter(
            (entry) => entry.installed !== undefined && !expected.has(entry.path) && !RETAINED_KINDS.has(entry.kind),
        )
        .map((entry) => proposeRestoration(log, entry.path));
    const plans = [...generatedPlans, ...pruning];
    const conflicts = plans.filter((plan) => plan.status === 'preserved').map((plan) => plan.path);
    if (reviewedOriginals !== undefined && conflicts.length > 0)
        throw new Error(
            `These files were not overwritten by gspot: ${conflicts.join(', ')}. Move them aside, then run gspot apply. Existing tool configuration is unchanged.`,
        );
    applyPlans(
        log,
        plans.filter((plan) => plan.status !== 'preserved'),
    );
    if (request.agentRulesEnabled) moveClaudeFile(log, report);
    pruneInstallations(log, root, retained);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...configurations].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    report.removed.push(...pruning.filter((plan) => plan.status !== 'preserved').map(({ path }) => path));
    if (conflicts.length > 0)
        throw new Error(
            `These edited files were not overwritten by gspot: ${conflicts.join(', ')}. Move them aside and run gspot apply again. The version pin is unchanged.`,
        );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Finding review/code-commands/006 retains this sole named policy check before generated writes.
function assertPolicyUnchanged(session: Session): void {
    if (readPolicyFile(session.root) !== session.policyFiles.text)
        throw new Error('The gspot.toml file changed while gspot was running. Run the command again.');
}

// A generated file a merge left with conflict markers is no edit anyone keeps: apply writes it again.
function conflictedOutputs(log: Log, generated: Generated): Map<string, FileCopy> {
    const conflicted = new Map<string, FileCopy>();
    for (const file of generated.files) {
        const current = log.files.read(file.path);
        if (current !== undefined && CONFLICT_MARKERS.test(current.bytes.toString('utf8')))
            conflicted.set(file.path, current);
    }
    return conflicted;
}

/**
 * Apply generated plans through the repository's lifecycle owner.
 * @param session the configuration and repository reads.
 * @param log the command's locked ownership context.
 * @param reviewedOriginals reviewed originals authorized for replacement.
 * @param prepared the generated outputs whose lockfiles were resolved before committing policy.
 * @returns generated changes.
 */
export function writeOutputs(
    session: Session,
    log: Log,
    reviewedOriginals?: ReadonlyMap<string, FileCopy | undefined>,
    prepared?: Generated,
): ApplyReport {
    // Generation requires a valid policy. Refuse errors before writing proposed files.
    assertNoProblems(session.policyFiles);

    assertPolicyUnchanged(session);
    const generated = prepared ?? emitAll(session);
    const report: ApplyReport = {
        written: [],
        unchanged: [],
        removed: [],
        updated: [],
        notes: [...generated.notes],
    };
    const paths = outputPaths(generated);
    writeGenerated(log, {
        agentRulesEnabled: session.policyFiles.policy.agent_rules.enabled,
        root: session.root,
        generated,
        report,
        retained: {
            prose: paths.has(VALE_CONFIG),
            packages: paths.has(TOOL_PACKAGE_PROJECT),
            python: paths.has(TOOL_PYTHON_PROJECT),
        },
        reviewedOriginals,
        conflictedOutputs: conflictedOutputs(log, generated),
    });
    const dependenciesChanged = generated.files.some(
        (file) =>
            report.written.includes(file.path) &&
            (file.kind === 'lock' ||
                file.kind === 'runner' ||
                [TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT].includes(file.path)),
    );
    const hasDrift = toolProjectDrift(session.root, generated.files).some((lockfile) => lockfile.kind !== undefined);
    if (dependenciesChanged || hasDrift) report.notes.push('Tool dependencies need installation. Run: gspot install');
    writeVersionPin(log);
    const rules = Object.fromEntries(
        generated.files.flatMap((file) => (file.ruleData === undefined ? [] : [[file.path, file.ruleData]])),
    );
    if (!isDeepStrictEqual(log.state.rules === undefined ? {} : log.state.rules, rules)) {
        if (Object.keys(rules).length === 0) delete log.state.rules;
        else log.state.rules = rules;
        log.save();
    }
    return report;
}
