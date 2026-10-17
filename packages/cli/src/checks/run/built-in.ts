import { buildBaseResult } from '#cli/checks/run/report.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { listWorkspaceDependencyFiles } from '#cli/tools/npm/packages.ts';

import type {
    Finding,
    CheckInput,
    CheckResult,
    BuiltInCheck,
    RunnableCheck,
    BuiltInCheckResult,
} from '#cli/types/checks/run/check.ts';

/**
 * Build the check result, with its check ID and run time, from built-in findings.
 * @param planned the check that ran.
 * @param completion what the run returned.
 * @param completion.input the scope and check.
 * @param completion.result the findings, and the covered files when known.
 * @param completion.started the monotonic start time.
 * @returns the check result.
 */
export function buildBuiltInResult(
    planned: PlannedCheck,
    completion: { input: CheckInput; result: Finding[] | BuiltInCheckResult; started: number },
): CheckResult {
    const { input, result, started } = completion;
    const findingResult: Pick<CheckResult, 'findings' | 'files'> & { fileCount?: number } = {
        findings: Array.isArray(result) ? result : result.findings,
    };
    if (!Array.isArray(result)) {
        findingResult.files = [...new Set(result.files)];
        findingResult.fileCount = findingResult.files.length;
    }
    for (const finding of findingResult.findings) finding.help ??= input.check.help;
    return {
        ...buildBaseResult(planned, { scopes: input.selections }),
        ...findingResult,
        status: findingResult.findings.length > 0 ? 'failed' : 'passed',
        duration: performance.now() - started,
    };
}

/**
 * Builds the input of a built-in check without the whole session.
 * @param session the repository and its tools.
 * @param planned the check to run.
 * @returns the files, settings, and reads that the check uses.
 */
export function checkInput(session: Session, planned: Pick<PlannedCheck, 'selection' | 'check' | 'files'>): CheckInput {
    return {
        generatedPaths: session.generatedPaths,
        toolFiles: session.toolFiles,
        timeoutSeconds: session.timeoutSeconds,
        dependencyFiles: () =>
            listWorkspaceDependencyFiles(
                session.root,
                planned.selection.scope.path,
                session.repository.files,
                session.reads,
            ),
        root: session.root,
        check: planned.check,
        files: planned.files,
        settingsFile: session.settingsFile,
        selection: planned.selection,
        selections: session.scopes,
        manifests: session.manifests,
        inspections: session.inspections,
        miseBinPaths: session.miseBinPaths,
        scopes: session.repository.scopes,
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
 * Wraps a built-in check implementation as a run callback.
 * @param builtInCheck the implementation to wrap.
 * @returns the callback that runs a planned check.
 */
export function runBuiltInCheck(builtInCheck: BuiltInCheck): RunnableCheck['run'] {
    return async (session, planned, options) => {
        const started = performance.now();
        const input = checkInput(session, planned);
        if (options?.staged) input.staged = options.staged;
        const result = await builtInCheck(input);
        return buildBuiltInResult(planned, { input, result, started });
    };
}
