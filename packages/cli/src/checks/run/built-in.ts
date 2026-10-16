import { emptyResult } from '#cli/checks/run/report.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { listWorkspaceDependencyFiles } from '#cli/tools/npm/packages.ts';

import {
    type Finding,
    type CheckInput,
    type CheckResult,
    type BuiltInCheck,
    type CheckOutcome,
    type RunnableCheck,
} from '#cli/types/execution/check.ts';

/**
 * Build the result of a completed built-in check and supply its missing help.
 * @param planned the selected check and repository scope.
 * @param root0 the completed invocation and its timing.
 * @param root0.input the checked repository files and services.
 * @param root0.outcome the returned findings and optional covered file paths.
 * @param root0.started the monotonic start time.
 * @returns the completed check result and covered file count.
 */
function buildCheckResult(
    planned: PlannedCheck,
    { input, outcome, started }: { input: CheckInput; outcome: Finding[] | CheckOutcome; started: number },
): CheckResult {
    const result: Pick<CheckResult, 'findings' | 'files' | 'fileCount'> = {
        findings: Array.isArray(outcome) ? outcome : outcome.findings,
        fileCount: input.files.length,
    };
    if (!Array.isArray(outcome)) {
        result.files = [...new Set(outcome.files)];
        result.fileCount = result.files.length;
    }
    for (const finding of result.findings) finding.help ??= input.check.help;
    return {
        ...emptyResult(planned),
        ...result,
        status: result.findings.length > 0 ? 'failed' : 'passed',
        duration: performance.now() - started,
    };
}

/**
 * Supply execution services and selected files without exposing the repository session.
 *
 * @param session the open session.
 * @param planned the planned check with its scope and files.
 *
 * @returns the check input.
 */
function checkInput(session: Session, planned: Pick<PlannedCheck, 'scope' | 'check' | 'files'>): CheckInput {
    return {
        generatedPaths: session.generatedPaths,
        timeoutSeconds: session.timeoutSeconds,
        dependencyFiles: () =>
            listWorkspaceDependencyFiles(
                session.root,
                planned.scope.scope.path,
                session.repository.files,
                session.reads,
            ),
        root: session.root,
        check: planned.check,
        files: planned.files,
        settingsFile: session.settingsFile,
        scope: planned.scope,
        selections: session.scopes,
        manifests: session.manifests,
        inspections: session.inspections,
        miseBinPaths: session.miseBinPaths,
        scopeEntries: session.repository.scopes,
        attributes: session.repository.attributes,
        index: session.repository.index,
        hasGit: session.repository.hasGit,
        reads: session.reads,
        resources: session.resources,
        repositoryFiles: session.repository.files,
        installedRoot: session.installedRoot,
        ...(session.cancelSignal === undefined ? {} : { cancelSignal: session.cancelSignal }),
    };
}

/**
 * Adapt one input-based check to the execution callback used by every built-in check.
 *
 * @param builtInCheck the selected implementation.
 *
 * @returns the callback that runs a planned check.
 */
function runBuiltInCheck(builtInCheck: BuiltInCheck): RunnableCheck['run'] {
    return async (session, planned, options) => {
        const started = performance.now();
        const input = checkInput(session, planned);
        if (options?.staged) input.staged = options.staged;
        const outcome = await builtInCheck(input);
        return buildCheckResult(planned, { input, outcome, started });
    };
}

export { checkInput, runBuiltInCheck, buildCheckResult };
