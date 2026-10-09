// Compares generated files with the files on disk.
import { createTwoFilesPatch } from 'diff';
import { isDeepStrictEqual } from 'node:util';
import { toPosix } from '#cli/platform/contracts.ts';
import { GspotError } from '#cli/platform/public.ts';
import type { Session } from '#cli/types/planning.ts';
import { openRoot } from '#cli/platform/root/public.ts';
import { toolProjectDrift } from '#cli/tools/public.ts';
import { generatedPaths } from '#cli/generation/public.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { CONFLICT_MARKERS } from '#cli/config/parsers/git.ts';
import { hasFields } from '#cli/lifecycle/merge/contracts.ts';
import { currentBlock } from '#cli/platform/root/contracts.ts';
import { runnerSchema } from '#cli/parsers/schema/contracts.ts';
import { readPolicyFile } from '#cli/policy/document/public.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import { RUNNING_VERSION } from '#cli/config/platform/runtime.ts';
import { errorText, assertNoErrors } from '#cli/policy/public.ts';
import { DRIFT_DIFF_CONTEXT } from '#cli/config/lifecycle/drift.ts';
import { RETAINED_PATHS } from '#cli/config/lifecycle/ownership.ts';
import type { CapturedRules } from '#cli/types/generation/rules.ts';
import type { Log, Ownership } from '#cli/types/lifecycle/ownership.ts';
import { planClaudeMove } from '#cli/lifecycle/ownership/claude-file.ts';
import { PIN_INSTALL_COMMANDS } from '#cli/config/lifecycle/version-pin.ts';
import { applyPlans, getOwnership } from '#cli/lifecycle/ownership/public.ts';
import { deleteInstallation } from '#cli/lifecycle/ownership/state/public.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import type { Drift, ApplyReport, WriteRequest } from '#cli/types/lifecycle/apply.ts';
import { planBlock, planMerge, planReplacement, planRestoration } from '#cli/lifecycle/ownership/contracts.ts';

import {
    VALE_CONFIG,
    POLICY_FILE,
    VERSION_FILE,
    HOOKS_DIRECTORY,
    TOOL_PYTHON_PROJECT,
    TOOL_PACKAGE_PROJECT,
} from '#cli/config/platform/locations.ts';

// An installation no selected configuration needs any more goes whole, and so do the Vale packages once nothing checks prose.
function pruneInstallations(log: Log, retained: WriteRequest['retained']): void {
    if (!retained.packages) deleteInstallation(log, 'npm');
    if (!retained.python) deleteInstallation(log, 'python');
    if (!retained.prose) deleteInstallation(log, 'vale');
}

// The text of `CLAUDE.md` lands after the block the batch wrote to `AGENTS.md`, and the file goes.
function moveClaudeFile(log: Log, report: ApplyReport): void {
    const moves = planClaudeMove(log);
    applyPlans(log, moves);
    if (moves.length > 0) report.removed.push('CLAUDE.md');
}

/**
 * Writes generated outputs and removes recorded outputs no configuration needs. Every plan is made before the first write.
 * @param log the locked ownership context.
 * @param request generated outputs, pruning policy, and reviewed originals.
 */
function writeGenerated(log: Log, request: WriteRequest): void {
    const { generated, report, retained, reviewedOriginals, conflictedOutputs } = request;
    const configurations = generated.toolFiles.map((output) => {
        const plan = planMerge(log, output.path, output.changes, true);
        return reviewedOriginals?.has(output.path) === true
            ? { ...plan, before: reviewedOriginals.get(output.path) }
            : plan;
    });
    const authorized = new Map([...(conflictedOutputs ?? []), ...(reviewedOriginals ?? [])]);
    const replacements = generated.files.map((file) => {
        const kind = file.kind === 'lock' || file.kind === 'hook' ? file.kind : 'tool_file';
        // A reviewed original or a file with merge conflict markers is replaced whatever its bytes are.
        const read = file.kind === 'lock' ? file.read : authorized.get(file.path);
        const replacement = {
            bytes: Buffer.from(file.content),
            mode: file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE,
        };
        const plan = planReplacement(log, {
            path: file.path,
            next: replacement,
            kind,
            canReplace: read !== undefined,
            expected: read,
        });
        return authorized.has(file.path) ? { ...plan, before: authorized.get(file.path) } : plan;
    });
    const blocks = generated.blocks.map((block) => planBlock(log, block.path, block.block, block.style));
    const generatedPlans = [...replacements, ...blocks, ...configurations];
    // `CLAUDE.md` is no output: it moves into `AGENTS.md` after the batch instead of getting its old text back.
    const expected = new Set([...generatedPaths(generated), 'CLAUDE.md']);
    // Pruning restores only recorded outputs that no selected owner still needs.
    const pruning = log.state.files
        .filter((entry) => isStray(entry, expected))
        .map((entry) => planRestoration(log, entry.path));
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
    pruneInstallations(log, retained);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...configurations].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    report.removed.push(...pruning.filter((plan) => plan.status !== 'preserved').map(({ path }) => path));
    if (report.removed.some((path) => path.startsWith(`${HOOKS_DIRECTORY}/`)))
        report.notes.push('Git hooks changed. Run: gspot install');
    if (conflicts.length > 0)
        throw new Error(
            `These edited files were not overwritten by gspot: ${conflicts.join(', ')}. Move them aside and run gspot apply again. The version pin is unchanged.`,
        );
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

function patch(path: string, before: string, after: string, beforeName: string): string {
    return createTwoFilesPatch(`a/${toPosix(path)}`, `b/${toPosix(path)}`, before, after, beforeName, 'generated', {
        context: DRIFT_DIFF_CONTEXT,
    });
}

function fileDrift(root: string, generated: Generated, ownership: Ownership): Drift[] {
    const { rules: previous = {} } = ownership;
    using files = openRoot(root);
    return generated.files.flatMap((file): Drift[] => {
        const baseline = previous[file.path];
        // A clone or revision copy has no private apply history; its generated bytes still establish freshness.
        const rules =
            baseline === undefined || file.ruleData === undefined ? [] : compareRules(baseline, file.ruleData);
        const changedRules = rules.length === 0 ? {} : { rules };
        const current = files.read(file.path);
        if (current === undefined) return [{ path: file.path, kind: 'missing', ...changedRules }];
        const disk = current.bytes.toString('utf8');
        // A merge left its markers in the file: regeneration repairs the unreadable configuration.
        if (CONFLICT_MARKERS.test(disk)) return [{ path: file.path, kind: 'conflict' }];
        if (disk !== file.content)
            return [
                {
                    path: file.path,
                    kind: 'changed',
                    diff: patch(file.path, disk, file.content, 'on disk'),
                    ...changedRules,
                },
            ];
        return rules.length === 0 ? [] : [{ path: file.path, kind: 'changed', rules }];
    });
}

function blockDrift(root: string, generated: Generated): Drift[] {
    const entries: Drift[] = [];
    using files = openRoot(root);
    for (const block of generated.blocks) {
        const text = files.read(block.path)?.bytes.toString('utf8') ?? '';
        const current = currentBlock(text, { path: block.path, style: block.style });
        const wanted = block.block.trim();
        if (current === undefined) entries.push({ path: block.path, kind: 'missing' });
        else if (current !== wanted)
            entries.push({
                path: block.path,
                kind: 'changed',
                diff: patch(block.path, current, wanted, 'managed block on disk'),
            });
    }
    return entries;
}

// The merged tool files whose fields are gone: missing when the file is gone, changed otherwise.
function keyDrift(root: string, generated: Generated): Drift[] {
    using files = openRoot(root);
    return [...generated.toolFiles]
        .filter((output) => !hasFields(root, output))
        .map((output) => ({ path: output.path, kind: files.read(output.path) === undefined ? 'missing' : 'changed' }));
}

/**
 * Whether a recorded output has no selected owner and is not retained.
 * @param entry the recorded output
 * @param expectedPaths the outputs and moves selected now
 * @returns whether apply restores the original file or removes the output
 */
export function isStray(entry: Ownership['files'][number], expectedPaths: ReadonlySet<string>): boolean {
    return entry.installed !== undefined && !expectedPaths.has(entry.path) && !RETAINED_PATHS.has(entry.path);
}

/**
 * Apply generated plans through the repository's lifecycle owner.
 * @param session the configuration and repository reads.
 * @param generated the generated outputs whose lockfiles were resolved before committing policy.
 * @param log the command's locked ownership context.
 * @param options reviewed originals authorized for replacement.
 * @returns generated changes.
 */
export function writeGeneratedFiles(
    session: Session,
    generated: Generated,
    log: Log,
    options?: Pick<WriteRequest, 'reviewedOriginals'>,
): ApplyReport {
    // Generation requires a valid policy. Refuse errors before writing proposed files.
    assertNoErrors(session.policyFiles);

    if (readPolicyFile(session.root) !== session.policyFiles.text)
        throw new Error('The gspot.toml file changed while gspot was running. Run the command again.');
    const reviewedOriginals = options?.reviewedOriginals;
    const report: ApplyReport = {
        written: [],
        unchanged: [],
        removed: [],
        updated: [],
        notes: [...generated.notes],
    };
    const paths = generatedPaths(generated);
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

/**
 * The pinned version, or undefined when the repository has none.
 * @param root the repository root
 * @returns the version in .gspot/version
 */
export function readVersionPin(root: string): string | undefined {
    using files = openRoot(root);
    const current = files.read(VERSION_FILE);
    if (current === undefined) return undefined;
    const line = current.bytes.toString('utf8').trim();
    return line === '' ? undefined : line;
}

/**
 * Writes the pin.
 * @param log the command's locked ownership context
 */
export function writeVersionPin(log: Log): void {
    const plan = planReplacement(log, {
        path: VERSION_FILE,
        next: { bytes: Buffer.from(`${RUNNING_VERSION}\n`), mode: OWNER_WRITABLE_FILE },
        kind: 'pin',
        canReplace: true,
    });
    if (plan.status === 'preserved')
        throw new Error(`${VERSION_FILE} was edited by hand. Delete it, then run gspot apply.`);
    applyPlans(log, [plan]);
}

/**
 * Throws when the repository pins another version than the running binary.
 * @param root the repository root
 * @param runner the captured root runner value
 */
export function assertVersionPin(root: string, runner: unknown): void {
    const pinned = readVersionPin(root);
    if (pinned !== undefined && pinned !== RUNNING_VERSION) {
        const selected = runnerSchema.optional().safeParse(runner);
        if (!selected.success)
            throw new GspotError(
                'policy',
                selected.error.issues.map((issue) =>
                    errorText({ path: ['runner'], message: issue.message }, POLICY_FILE),
                ),
            );
        const install = selected.data === undefined ? 'npm install --global' : PIN_INSTALL_COMMANDS[selected.data];
        const command = selected.data === 'mise' ? install : `${install} @gspothq/cli@${pinned}`;
        throw new GspotError(
            'pin',
            [
                `This repository pins gspot ${pinned} and this binary is ${RUNNING_VERSION}.`,
                `Install the pinned version: ${command}`,
                'To upgrade the repository pin to this version: gspot apply',
            ].join('\n'),
        );
    }
}

/**
 * Every generated file that differs from its emitted text, is missing, or is a stray gspot file. Managed blocks and authored config-file edits count too.
 * @param root the repository root
 * @param generated the generated files as generated now
 * @returns the drift entries in path order
 */
export function computeDrift(root: string, generated: Generated): Drift[] {
    const ownership = getOwnership(root);
    const known = new Set([...generatedPaths(generated), 'CLAUDE.md']);
    const lockfiles = toolProjectDrift(root, generated.files);
    const strays = ownership.files
        .filter((entry) => isStray(entry, known))
        .map((entry): Drift => ({ path: entry.path, kind: 'stray' }));
    return [
        ...lockfiles.flatMap(({ path, kind }) => (kind === undefined ? [] : [{ path, kind }])),
        ...fileDrift(root, generated, ownership),
        ...blockDrift(root, generated),
        ...keyDrift(root, generated),
        ...strays,
    ].toSorted((a, b) => a.path.localeCompare(b.path));
}

/**
 * Compare generated rule data with the last successful apply, independent of edited file bytes.
 * @param previous the rule values recorded after the last successful apply
 * @param proposed the current generated rule values
 * @returns added, removed, and changed rules under each declared path
 */
export function compareRules(previous: CapturedRules, proposed: CapturedRules): NonNullable<Drift['rules']> {
    const paths = new Set([...Object.keys(previous), ...Object.keys(proposed)]);
    return [...paths].flatMap((path) => {
        const before = previous[path];
        const next = proposed[path];
        const added = (next === undefined ? [] : Object.keys(next))
            .filter((rule) => before === undefined || !Object.hasOwn(before, rule))
            .toSorted((left, right) => left.localeCompare(right));
        const removed = (before === undefined ? [] : Object.keys(before))
            .filter((rule) => next === undefined || !Object.hasOwn(next, rule))
            .toSorted((left, right) => left.localeCompare(right));
        const changed = (next === undefined ? [] : Object.keys(next))
            .filter(
                (rule) =>
                    before !== undefined &&
                    Object.hasOwn(before, rule) &&
                    !isDeepStrictEqual(before[rule], next?.[rule]),
            )
            .toSorted((left, right) => left.localeCompare(right));
        return added.length + removed.length + changed.length === 0 ? [] : [{ path, added, removed, changed }];
    });
}
