// Built-in checks share one execution callback; command checks run their declared commands.
import { join } from 'node:path';
import { emptyResult } from '#cli/execution/report.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';

import type {
    CheckInput,
    Executable,
    CheckResult,
    BuiltInCheck,
    CheckOutcome,
    BuiltInChecks,
} from '#cli/types/execution/check.ts';

// Explicit coverage must stay within the source inventory the built-in check received.
function assertCoverage(input: CheckInput, files: string[]): void {
    const allowedFiles = input.repositoryFiles ?? input.files;
    const outside = files.find((path) => !allowedFiles.some((file) => file.path === path));
    if (outside !== undefined)
        throw new Error(`The built-in check reported coverage for ${outside}, outside its supplied source inventory.`);
}

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
        assertCoverage(input, result.files);
        result.fileCount = result.files.length;
    }
    for (const finding of result.findings) finding.help ??= input.check.help;
    return result;
}

/**
 * Supply execution services and selected files without exposing the repository session.
 * @param session the open session
 * @param planned the planned check with its scope and files
 * @returns the check input
 */
export function checkInput(session: ToolSession, planned: Pick<PlannedCheck, 'scope' | 'check' | 'files'>): CheckInput {
    const input: CheckInput = {
        root: session.root,
        scope: planned.scope.scope.path,
        scopeRoot: join(session.root, planned.scope.scope.path),
        view: planned.scope.view,
        check: planned.check,
        files: planned.files,
        policyFiles: session.policyFiles,
        selection: planned.scope,
        selections: session.scopes,
        manifests: session.manifests,
        inspections: session.inspections,
        scopeEntries: session.repository.scopes,
        attributes: session.repository.attributes,
        index: session.repository.index,
        hasGit: session.repository.hasGit,
        reads: session.reads,
        ...(session.installedRoot === undefined ? {} : { installedRoot: session.installedRoot }),
        ...(session.resources === undefined ? {} : { resources: session.resources }),
        ...(session.cancelSignal === undefined ? {} : { cancelSignal: session.cancelSignal }),
    };
    if (planned.check.runs === 'once') {
        input.repositoryFiles = session.repository.files;
    }
    return input;
}

/**
 * Adapt one input-based check to the execution callback used by every built-in check.
 * @param builtInCheck the selected implementation.
 * @returns the callback that runs a planned check.
 */
export function runBuiltInCheck(builtInCheck: BuiltInCheck): Executable['run'] {
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

/**
 * Select an implementation before execution starts.
 * @param check the selected check definition
 * @param checks the checks gspot runs itself
 * @returns the function that runs the check
 */
export function checkRun(check: CheckDeclaration, checks: BuiltInChecks): Executable['run'] {
    const implementation = checks[check.name];
    if (implementation !== undefined) return implementation.run;
    if (check.command === undefined) {
        throw new Error(`The check ${check.name} names no command, and gspot has no built-in check by that name.`);
    }
    return runCheckCommand;
}
