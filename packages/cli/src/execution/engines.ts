// Running a check: the registry names the engine or the tool runner of each built-in check; every other check runs its command.
import { join } from 'node:path';
import { emptyResult } from '#cli/execution/report.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckSpec } from '#cli/types/configurations.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { runCommandCheck } from '#cli/execution/command/runner.ts';

import type {
    Engine,
    Executable,
    CheckResult,
    EngineInput,
    CheckRegistry,
    EngineOutcome,
} from '#cli/types/execution/runtime.ts';

// Explicit coverage must stay within the source inventory the engine received.
function assertCoverage(input: EngineInput, files: string[]): void {
    const allowedFiles = input.repositoryFiles ?? input.files;
    const outside = files.find((path) => !allowedFiles.some((file) => file.path === path));
    if (outside !== undefined)
        throw new Error(`The engine reported coverage for ${outside}, outside its supplied source inventory.`);
}

// The findings and covered files an engine returned, with missing help supplied by its check.
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
        assertCoverage(input, result.files);
        result.fileCount = result.files.length;
    }
    for (const finding of result.findings) finding.help ??= input.spec.help;
    return result;
}

/**
 * Supply execution services and selected files without exposing the repository session.
 * @param session the open session
 * @param planned the planned check with its scope and files
 * @returns the engine input
 */
export function engineInput(
    session: ToolSession,
    planned: Pick<PlannedCheck, 'scope' | 'spec' | 'files'>,
): EngineInput {
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
        ...(session.installedRoot === undefined ? {} : { installedRoot: session.installedRoot }),
        ...(session.resources === undefined ? {} : { resources: session.resources }),
        ...(session.cancelSignal === undefined ? {} : { cancelSignal: session.cancelSignal }),
    };
    if (planned.spec.runs === 'once') {
        input.repositoryFiles = session.repository.files;
        input.selections = session.scopes;
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
    session: ToolSession,
    engine: Engine,
    planned: PlannedCheck,
    staged?: Set<string>,
): Promise<CheckResult> {
    const base = emptyResult(planned);
    const started = performance.now();
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
}

/**
 * Select an implementation before execution starts.
 * @param spec the selected check definition
 * @param checks the checks gspot runs itself
 * @returns the function that runs the check
 */
export function getCheckRunner(spec: CheckSpec, checks: CheckRegistry): Executable['run'] {
    const implementation = checks[spec.name];
    if (implementation !== undefined) {
        if ('run' in implementation) return implementation.run;
        return (session, planned, options) => runEngineCheck(session, implementation.engine, planned, options?.staged);
    }
    if (spec.command === undefined) {
        throw new Error(`The check ${spec.name} names no command, and gspot has no built-in check by that name.`);
    }
    return runCommandCheck;
}
