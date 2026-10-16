// The findings and covered files a built-in check returned, with missing help supplied by its check.

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
 * Attach check identity and elapsed time to the built-in findings.
 * @param planned the selected check declaration.
 * @param completion the execution values.
 * @param completion.input the selected sources and execution services.
 * @param completion.result the findings and optional covered files.
 * @param completion.started the monotonic start time.
 * @returns the completed built-in result.
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
 * Supply execution services and selected files without exposing the repository session.
 *
 * @param session the open session.
 * @param planned the planned check with its scope and files.
 *
 * @returns the execution services and source inventory available to one planned analysis.
 */
export function checkInput(session: Session, planned: Pick<PlannedCheck, 'scope' | 'check' | 'files'>): CheckInput {
    return {
        generatedPaths: session.generatedPaths,
        toolFiles: session.toolFiles,
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
 * Adapt one input-based check to the execution callback used by every built-in check.
 *
 * @param builtInCheck the selected implementation.
 *
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
