// Dispatch to the built-in engines by `engine =` in the manifest.
import { join } from 'node:path';
import type { CheckSpec } from '#cli/types/kits.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { banned } from '#cli/checks/prose/banned.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { checkActions } from '#cli/checks/actions.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { valeFindings } from '#cli/checks/prose/vale.ts';
import { integrityEngine } from '#cli/checks/dispatch.ts';
import { checkSwiftlint } from '#cli/checks/swift/lint.ts';
import { namingEngine } from '#cli/checks/naming/engine.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { checkDependencies } from '#cli/checks/python/project.ts';
import { structureEngine } from '#cli/checks/structure/engine.ts';
import { checkDocstrings } from '#cli/checks/python/docstrings.ts';
import { checkSecretHistory } from '#cli/checks/secrets/history.ts';
import { checkCommitMessages } from '#cli/checks/commit-messages.ts';
import { checkVerifiedSecrets } from '#cli/checks/secrets/verified.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';
import { checkJavascript, checkTypescript } from '#cli/checks/typescript/tsc.ts';
import type { Session, Executable, PlannedCheck } from '#cli/types/execution/execution.ts';
import type { Engine, Finding, CheckResult, EngineInput, EngineOutcome } from '#cli/types/checks.ts';

// A tool check runs the command of its definition; staged state does not change the command.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Executable.run passes the staged set third, where runToolCheck takes a command, so the tool check drops it here.
const toolCheck: Executable['run'] = (session, planned) => runToolCheck(session, planned);

const engines: Record<NonNullable<CheckSpec['engine']>, (spec: CheckSpec) => Engine> = {
    integrity: integrityEngine,
    naming: namingEngine,
    structure: structureEngine,
    prose(spec) {
        if (spec.analysis === 'vale') return valeFindings;
        if (spec.analysis === 'banned') return banned;
        throw new Error(`No prose analysis is called ${spec.analysis ?? ''}.`);
    },
};

const analyses = new Map<string, Executable['run']>([
    ['verified-secrets', checkVerifiedSecrets],
    ['gitleaks-history', checkSecretHistory],
    ['commit-messages', checkCommitMessages],
    ['typescript', checkTypescript],
    ['javascript', checkJavascript],
    ['swiftlint', checkSwiftlint],
    ['pydoclint', checkDocstrings],
    ['deptry', checkDependencies],
    ['actions', checkActions],
]);

// Prepare asynchronous repository reads before handing input to the selected engine.
async function executionInput(
    session: Session,
    planned: PlannedCheck,
    staged: Set<string> | undefined,
): Promise<EngineInput> {
    const input = engineInput(session, planned);
    if (planned.spec.runs === 'once' && planned.spec.analysis === 'suppressions')
        input.suppressions = await suppressionComments(
            session.root,
            session.scopes,
            session.reads,
            planned.files.filter((file) => file.kind === 'source' && file.tags.includes('text')),
        );
    if (staged) input.staged = staged;
    return input;
}

// Explicit coverage must stay within the source inventory the engine received.
function checkCoverage(input: EngineInput, checkedFiles: string[]): void {
    const allowedFiles = input.repositoryFiles ?? input.files;
    if (checkedFiles.some((path) => !allowedFiles.some((file) => file.path === path)))
        throw new Error('The engine reported coverage for a file outside its supplied source inventory.');
}

// Normalize engine output and annotate its findings with the declared engine and help.
function engineResult(
    input: EngineInput,
    outcome: Finding[] | EngineOutcome,
): Pick<CheckResult, 'findings' | 'checkedFiles' | 'files'> {
    const result: Pick<CheckResult, 'findings' | 'checkedFiles' | 'files'> = {
        findings: Array.isArray(outcome) ? outcome : outcome.findings,
        files: input.files.length,
    };
    if (!Array.isArray(outcome)) {
        result.checkedFiles = [...new Set(outcome.checkedFiles)];
        checkCoverage(input, result.checkedFiles);
        result.files = result.checkedFiles.length;
    }
    for (const finding of result.findings) {
        if (input.spec.engine !== undefined) finding.engine = input.spec.engine;
        finding.help ??= input.spec.help;
    }
    return result;
}

// Classify missing tools and unmet prerequisites separately from engine errors.
function failureOf(name: string, error: unknown): Pick<CheckResult, 'status' | 'note'> {
    if (error instanceof GspotError && error.code === 'skipped') return { status: 'skipped', note: error.message };
    if (error instanceof GspotError && error.code === 'missing-tool') return { status: 'missing', note: error.message };
    return { status: 'error', note: `the ${name} engine failed: ${(error as Error).message}` };
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
        if (planned.spec.analysis === 'generated-drift')
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
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
    };
    const name = spec.engine;
    const started = performance.now();
    try {
        const input = await executionInput(session, planned, staged);
        const outcome = await engine(input);
        const result = engineResult(input, outcome);
        return {
            ...base,
            ...result,
            status: result.findings.length > 0 ? 'fail' : 'ok',
            duration: performance.now() - started,
        };
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...failureOf(name ?? spec.name, error) };
    }
}

/**
 * Select an implementation before execution starts.
 * @param spec the selected check definition
 * @returns the function that runs the check
 */
export function checkExecution(spec: CheckSpec): Executable['run'] {
    if (spec.engine !== undefined) {
        const engine = engines[spec.engine](spec);
        return (session, planned, staged) => runEngineCheck(session, engine, planned, staged);
    }
    const analysis = spec.analysis === undefined ? undefined : analyses.get(spec.analysis);
    if (analysis !== undefined) return analysis;
    return toolCheck;
}
