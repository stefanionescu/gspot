// Running a check: the registry names the engine or the tool runner of each built-in check; every other check runs its command.
import { join } from 'node:path';
import type { CheckSpec } from '#cli/types/kits.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { GENERATED_DRIFT_CHECK } from '#cli/config/execution/execution.ts';

import type {
    Engine,
    Finding,
    Executable,
    CheckResult,
    EngineInput,
    PlannedCheck,
    CheckRegistry,
    EngineOutcome,
} from '#cli/types/execution/execution.ts';

// A tool check runs the command of its definition; staged state does not change the command.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Executable.run passes the staged set third, where runToolCheck takes a command, so the tool check drops it here.
const toolCheck: Executable['run'] = (session, planned) => runToolCheck(session, planned);

// Explicit coverage must stay within the source inventory the engine received.
function checkCoverage(input: EngineInput, files: string[]): void {
    const allowedFiles = input.repositoryFiles ?? input.files;
    if (files.some((path) => !allowedFiles.some((file) => file.path === path)))
        throw new Error('The engine reported coverage for a file outside its supplied source inventory.');
}

// Normalize engine output and annotate its findings with the declared engine and help.
function engineResult(
    input: EngineInput,
    outcome: Finding[] | EngineOutcome,
): Pick<CheckResult, 'findings' | 'files' | 'fileCount'> {
    const result: Pick<CheckResult, 'findings' | 'files' | 'fileCount'> = {
        findings: Array.isArray(outcome) ? outcome : outcome.findings,
        fileCount: input.files.length,
    };
    if (!Array.isArray(outcome)) {
        result.files = [...new Set(outcome.files)];
        checkCoverage(input, result.files);
        result.fileCount = result.files.length;
    }
    for (const finding of result.findings) finding.help ??= input.spec.help;
    return result;
}

/**
 * Classify missing tools and unmet prerequisites separately from the errors of a check.
 * @param name the check
 * @param error what the check threw
 * @returns the status and the note of the check
 */
export function failureOf(name: string, error: unknown): Pick<CheckResult, 'status' | 'note'> {
    if (error instanceof GspotError && error.code === 'skip') return { status: 'skipped', note: error.message };
    if (error instanceof GspotError && error.code === 'tool') return { status: 'missing', note: error.message };
    return { status: 'error', note: `the ${name} check failed: ${(error as Error).message}` };
}

/**
 * Supply execution services and selected files without exposing the repository session.
 * @param session the open session
 * @param planned the planned check with its scope and files
 * @returns the engine input
 */
export function engineInput(session: Session, planned: Pick<PlannedCheck, 'scope' | 'spec' | 'files'>): EngineInput {
    const input: EngineInput = {
        root: session.root,
        scope: planned.scope.scope.path,
        scopeRoot: join(session.root, planned.scope.scope.path),
        view: planned.scope.view,
        spec: planned.spec,
        files: planned.files,
        policyFiles: session.policyFiles,
        selection: planned.scope,
        manifests: session.manifests,
        inspections: session.inspections,
        scopeEntries: session.repository.scopes,
        attributes: session.repository.attributes,
        hasGit: session.repository.hasGit,
        reads: session.reads,
        ...(session.resources === undefined ? {} : { resources: session.resources }),
        ...(session.cancelSignal === undefined ? {} : { cancelSignal: session.cancelSignal }),
    };
    if (planned.spec.runs === 'once') {
        input.repositoryFiles = session.repository.files;
        input.selections = session.scopes;
        if (planned.spec.name === GENERATED_DRIFT_CHECK)
            input.generatedDrift = () =>
                computeDrift(
                    session.root,
                    session.policyFiles.policy,
                    emitAll(session.policyFiles.policy, session.repository, session.scopes, {
                        version: session.version,
                        packageClient: session.packageClient,
                    }),
                );
    }
    return input;
}

/**
 * Runs one planned engine check.
 * @param session the session
 * @param engine the selected implementation
 * @param planned the check to run
 * @param staged the staged paths, in staged mode
 * @returns the check result with its findings
 */
export async function runEngineCheck(
    session: Session,
    engine: Engine,
    planned: PlannedCheck,
    staged?: Set<string>,
): Promise<CheckResult> {
    const { spec, scope } = planned;
    const base: CheckResult = {
        check: spec.name,
        scope: scope.scope.path,
        status: 'passed',
        fileCount: planned.files.length,
        duration: 0,
        findings: [],
    };
    const started = performance.now();
    try {
        const input = engineInput(session, planned);
        if (staged) input.staged = staged;
        const outcome = await engine(input);
        const result = engineResult(input, outcome);
        return {
            ...base,
            ...result,
            status: result.findings.length > 0 ? 'failed' : 'passed',
            duration: performance.now() - started,
        };
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...failureOf(spec.name, error) };
    }
}

/**
 * Select an implementation before execution starts.
 * @param spec the selected check definition
 * @param checks the checks gspot runs itself
 * @returns the function that runs the check
 */
export function checkExecution(spec: CheckSpec, checks: CheckRegistry): Executable['run'] {
    const runner = checks.runners[spec.name];
    if (runner !== undefined) return runner;
    const engine = checks.engines[spec.name];
    if (engine !== undefined) return (session, planned, staged) => runEngineCheck(session, engine, planned, staged);
    if (spec.command === undefined) {
        throw new Error(`The check ${spec.name} names no command, and gspot has no built-in check by that name.`);
    }
    return toolCheck;
}
