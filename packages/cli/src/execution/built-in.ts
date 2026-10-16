import { emptyResult } from '#cli/execution/report.ts';
import { workspaceSourceFiles } from '#cli/repository/scopes.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';

import type {
    Finding,
    CheckInput,
    CheckResult,
    BuiltInCheck,
    CheckOutcome,
    RunnableCheck,
} from '#cli/types/execution/check.ts';

// The findings and covered files a built-in check returned, with missing help supplied by its check.
function checkResult(
    input: CheckInput,
    outcome: Finding[] | CheckOutcome,
): Pick<CheckResult, 'findings' | 'files' | 'fileCount'> {
    const result: Pick<CheckResult, 'findings' | 'files' | 'fileCount'> = {
        findings: Array.isArray(outcome) ? outcome : outcome.findings,
        fileCount: input.files.length,
    };
    if (!Array.isArray(outcome)) {
        result.files = [...new Set(outcome.files)];
        result.fileCount = result.files.length;
    }
    for (const finding of result.findings) finding.help ??= input.check.help;
    return result;
}

/**
 * Supply execution services and selected files without exposing the repository session.
 *
 * @param session the open session.
 * @param planned the planned check with its scope and files.
 *
 * @returns the check input.
 */
export function checkInput(session: Session, planned: Pick<PlannedCheck, 'scope' | 'check' | 'files'>): CheckInput {
    const input: CheckInput = {
        generatedPaths: session.generatedPaths,
        timeoutSeconds: session.timeoutSeconds,
        dependencyFiles: () =>
            workspaceSourceFiles(session.root, planned.scope.scope.path, session.repository.files, session.reads),
        root: session.root,
        check: planned.check,
        files: planned.files,
        settingsFile: session.settingsFile,
        selection: planned.scope,
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
    return input;
}

/**
 * Adapt one input-based check to the execution callback used by every built-in check.
 *
 * @param builtInCheck the selected implementation.
 *
 * @returns the callback that runs a planned check.
 */
export function runBuiltInCheck(builtInCheck: BuiltInCheck): RunnableCheck['run'] {
    return async (session, planned, options) => {
        const base = emptyResult(planned);
        const started = performance.now();
        const input = checkInput(session, planned);
        if (options?.staged) input.staged = options.staged;
        const outcome = await builtInCheck(input);
        const result = checkResult(input, outcome);
        return {
            ...base,
            ...result,
            status: result.findings.length > 0 ? 'failed' : 'passed',
            duration: performance.now() - started,
        };
    };
}
