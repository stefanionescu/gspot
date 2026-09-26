import pLimit from 'p-limit';
import { cpus } from 'node:os';
import { applyFixers } from '#cli/execution/fixers.ts';
import type { Session } from '#cli/execution/session.ts';
import { resolveCheck } from '#cli/execution/engines.ts';
import type { FixReport } from '#cli/execution/fixers.ts';
import { writeReport } from '#cli/output/report.ts';
import type { IgnoreUse } from '#cli/execution/ignores.ts';
import { probeTool } from '#cli/tools/probe.ts';
import { coverageReport } from '#cli/execution/coverage.ts';
import { reproduceLine } from '#cli/execution/reproduce.ts';
import { prepareCommand } from '#cli/execution/tool-runner.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { jobsWanted } from '#cli/platform/environment.ts';
import type { IgnoreEntry } from '#cli/policy/normalize.ts';
import { isAbsolute, join, relative, sep } from 'node:path';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import type { PlanOptions, PlannedCheck } from '#cli/execution/plan.ts';
import type { SourceObservations } from '#cli/repository/tracked.ts';
import { claimedInputs, isActive, planRun } from '#cli/execution/plan.ts';
import { commandConfigurations } from '#cli/execution/command-expansion.ts';
import { applyIgnores, applyInlineIgnores } from '#cli/execution/ignores.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import type { RunReport } from '#cli/execution/report.ts';
import type { CheckResult, Finding } from '#cli/checks/result.ts';
// The orchestrator: plan, run, filter through ignores, report, decide the exit code.
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';
import {
    cacheInputs,
    cacheKey,
    fileHash,
    pruneCache,
    readCached,
    textHash,
    writeCached,
} from '#cli/execution/cache.ts';

/** File observations shared by cached checks within one execution pass. */
type RunHashes = {
    policy: string;
    files: Map<string, string>;
    tools: Map<string, string>;
};

const NEVER_CACHED = new Set(['integrity/generated-drift', 'commits/commitlint', 'commits/range']);
const RAN_STATUSES = new Set(['ok', 'cache', 'fail']);
const FAILED_STATUSES = new Set(['fail', 'missing', 'error']);
const POLICY_CHECK = 'integrity/policy';
const DOCKER = { name: 'docker', provider: 'host' as const, windows: true, installers: {} };

function toolVersionOf(session: Session, planned: PlannedCheck, hashes: RunHashes): string {
    if (!planned.tool) return 'engine';
    const { env, cwd } = prepareCommand(session, planned, planned.spec.command ?? []);
    const probe = probeTool({ ...session, cwd }, { ...planned.tool, env });
    if (probe.path === undefined) return JSON.stringify(probe);
    const path = realpathSync(probe.path);
    let identity = hashes.tools.get(path);
    if (identity === undefined) {
        const local = relative(session.root, path);
        const identityPath =
            session.cacheRoot !== undefined && !isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`)
                ? join(session.cacheRoot, local)
                : path;
        identity = JSON.stringify({
            path: identityPath,
            mode: statSync(path).mode,
            hash: new Bun.CryptoHasher('sha256').update(readFileSync(path)).digest('hex'),
        });
        hashes.tools.set(path, identity);
    }
    return JSON.stringify([planned.tool.name, probe.state, probe.found, identity]);
}

function observedHash(session: Session, path: string, hashes: RunHashes): string {
    const held = hashes.files.get(path);
    if (held !== undefined) return held;
    const hash = fileHash(session.root, path, session.observations);
    hashes.files.set(path, hash);
    return hash;
}

function configurationHashes(session: Session, planned: PlannedCheck, hashes: RunHashes): string {
    return JSON.stringify(
        commandConfigurations(session, planned).map((path) => {
            try {
                return { path, hash: observedHash(session, path, hashes) };
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
                return { path, hash: 'missing' };
            }
        }),
    );
}

function keyFor(session: Session, planned: PlannedCheck, config: RunHashes): string | undefined {
    const declared =
        planned.manifest === undefined
            ? session.policyFiles.policy.checks.find((entry) => entry.name === planned.check)?.inputs
            : undefined;
    // Repository paths select a check, but only explicit inputs authorize caching its result.
    if (planned.manifest === undefined && declared === undefined) return undefined;
    // SwiftLint's syntax supplement reads only selected sources and the same native configurations.
    // Other analyses can read undeclared files and run multiple tools.
    if (
        planned.spec.engine !== undefined ||
        (planned.spec.analysis !== undefined && planned.spec.analysis !== 'swiftlint')
    )
        return undefined;
    if (NEVER_CACHED.has(planned.check) || planned.spec.requires !== undefined) return undefined;
    if (planned.spec.runs !== 'per-file-list' && planned.files.length === 0) return undefined;
    const inputs = declared === undefined ? [] : cacheInputs(session.root, declared);
    const paths = [...new Set([...planned.files.map((file) => file.path), ...inputs])].toSorted((left, right) =>
        left.localeCompare(right),
    );
    const files = paths.map((path) => ({ path, hash: observedHash(session, path, config) }));
    return cacheKey({
        check: planned.check,
        scope: planned.scope.scope.path,
        toolVersion: toolVersionOf(session, planned, config),
        configurationHash: config.policy,
        files,
        extra: `${session.version}\n${configurationHashes(session, planned, config)}`,
    });
}

function cachedResult(root: string, key: string, planned: PlannedCheck): CheckResult | undefined {
    const cached = readCached(root, key);
    if (!cached) return undefined;
    const status = cached.status === 'ok' ? 'cache' : cached.status;
    return { ...cached, status, check: planned.check, scope: planned.scope.scope.path };
}

function unrunnable(session: Session, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (planned.spec.requires === 'docker' && probeTool(session, DOCKER).state === 'missing')
        return { ...base, status: 'missing', note: 'this check needs a Docker daemon and docker is not installed' };
    return undefined;
}

async function runOne(
    session: Session,
    planned: PlannedCheck,
    run: ReturnType<typeof resolveCheck>,
    options: RunOptions,
    config: RunHashes,
    staged?: Set<string>,
): Promise<CheckResult> {
    const base: CheckResult = {
        check: planned.check,
        scope: planned.scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
    };
    const early = unrunnable(session, planned, base);
    if (early) return early;
    const key = options.noCache === true ? undefined : keyFor(session, planned, config);
    const cached = key === undefined ? undefined : cachedResult(session.cacheRoot ?? session.root, key, planned);
    if (cached) return cached;
    const result = await run(session, planned, staged);
    if (key !== undefined && !options.isDryRun && RAN_STATUSES.has(result.status)) {
        const stored =
            session.cacheRoot === undefined || result.command === undefined
                ? result
                : {
                      ...result,
                      command: result.command.map((part) => part.replaceAll(session.root, () => session.cacheRoot!)),
                  };
        writeCached(session.cacheRoot ?? session.root, key, stored);
    }
    return result;
}

function census(session: Session, files: TrackedFile[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of suppressionComments(session.root, session.scopes, session.observations, files))
        counts[entry.form] = (counts[entry.form] ?? 0) + 1;
    return counts;
}

function mergeUses(into: Map<string, IgnoreUse>, uses: IgnoreUse[]): void {
    for (const use of uses) {
        const key = JSON.stringify(use.entry);
        const existing = into.get(key) ?? { entry: use.entry, matched: 0 };
        existing.matched += use.matched;
        into.set(key, existing);
    }
}

function ignoreRows(uses: Map<string, IgnoreUse>): RunReport['ignores'] {
    return uses
        .values()
        .map(({ entry, matched }) => ({
            check: entry.check,
            ...(entry.rule === undefined ? {} : { rule: entry.rule }),
            ...(entry.paths === undefined ? {} : { paths: entry.paths }),
            ...(entry.reason === undefined ? {} : { reason: entry.reason }),
            matched,
        }))
        .toArray();
}

function filterResult(
    observations: SourceObservations,
    check: PlannedCheck,
    result: CheckResult,
    ignores: IgnoreEntry[],
    uses: Map<string, IgnoreUse>,
    options: RunOptions,
): void {
    if (RAN_STATUSES.has(result.status)) {
        const countedFailure = check.spec.count_regex !== undefined && result.status === 'fail';
        const inline = applyInlineIgnores(observations, result.findings);
        const ignored = applyIgnores(
            inline,
            ignores.filter((entry) => entry.check === check.check),
        );
        mergeUses(uses, ignored.uses);
        result.findings = ignored.kept;
        if (countedFailure || result.findings.length > 0) result.status = 'fail';
        else if (result.status !== 'cache') result.status = 'ok';
    }
    if (FAILED_STATUSES.has(result.status))
        result.reproduce = `${reproduceLine(result.check, result.scope, { stage: check.spec.stage, ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }) })}${options.comparison?.content === 'index' ? ' --staged' : ''}`;
}

function skipRows(planned: PlannedCheck[]): RunReport['skips'] {
    return planned.flatMap((check) => (check.skip ? [{ check: check.check, source: check.skip.source }] : []));
}

// The wrong lines of gspot.toml that reading dropped, reported as one failed check so the rest of the run stands.
function policyProblemsResult(session: Session): CheckResult | undefined {
    const { problems } = session.policyFiles;
    if (problems.length === 0) return undefined;
    return {
        check: POLICY_CHECK,
        scope: '',
        status: 'fail',
        files: 1,
        duration: 0,
        findings: problems.map((problem) => ({
            check: POLICY_CHECK,
            engine: 'integrity',
            file: 'gspot.toml',
            line: problem.line,
            column: problem.column,
            message: problem.message,
            fixable: false,
        })),
    };
}

function failedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const corrections = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...corrections])];
}

/**
 * Runs the checks and returns the report. Writes .gspot/reports/report.json.
 * @param opened the session
 * @param options stage, skips, fix and cache flags
 * @returns the report, the plan, and the fix report when --fix ran
 */
export async function executeRun(opened: Session, options: RunOptions): Promise<RunOutcome> {
    using resources = new DisposableStack();
    const session = {
        ...opened,
        observations: { root: opened.root, sources: new Map<string, Buffer>() },
        resources,
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    };
    session.probes.clear();
    const started = new Date();
    let planned = await planRun(session, options);
    let executable = planned.map((check) => ({ check, run: resolveCheck(check.spec) }));
    const fixes = options.fix ? await applyFixers(session, planned, options.isDryRun) : undefined;
    if (fixes !== undefined && !options.isDryRun) {
        const { declarations, scopes, exclude } = session.policyFiles.policy;
        session.repository = await readRepository(session.root, declarations, scopes, exclude);
        opened.repository = session.repository;
        session.observations = { root: session.root, sources: new Map() };
        session.probes.clear();
        planned = await planRun(session, options);
        executable = planned.map((check) => ({ check, run: resolveCheck(check.spec) }));
    }
    const config = { policy: textHash(session.policyFiles.text), files: new Map(), tools: new Map() };
    const staged = options.staged ? new Set(options.staged) : undefined;
    const limiter = pLimit(jobsWanted() ?? Math.max(1, cpus().length));
    const active = planned.filter(isActive);
    const { ignores } = session.policyFiles.policy;
    const uses = new Map<string, IgnoreUse>(ignores.map((entry) => [JSON.stringify(entry), { entry, matched: 0 }]));
    const settled = await Promise.allSettled(
        executable
            .filter(({ check }) => isActive(check))
            .map(({ check, run }) =>
                limiter(async () => {
                    const result = await runOne(session, check, run, options, config, staged);
                    filterResult(session.observations, check, result, ignores, uses, options);
                    options.onResult?.(result);
                    return result;
                }),
            ),
    );
    const ran = settled.map((result) => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
    });
    const policyResult = options.stage === 'message' ? undefined : policyProblemsResult(session);
    if (policyResult !== undefined) options.onResult?.(policyResult);
    const results = policyResult === undefined ? ran : [...ran, policyResult];
    const failed = failedChecks(results, fixes);
    const unable =
        session.cancelSignal?.aborted === true ||
        results.some((result) => result.status === 'missing' || result.status === 'error') ||
        fixes?.results.some((result) => result.status === 'failed') === true;
    const claimed = new Set(
        active.flatMap((check, index) => {
            if (!RAN_STATUSES.has(ran[index]!.status)) return [];
            if (ran[index]!.checkedFiles !== undefined) return ran[index]!.checkedFiles;
            return claimedInputs(session, check).map((file) => file.path);
        }),
    );
    const sources = session.repository.files.filter((file) => file.nature === 'source');
    const checkedSources = sources.filter((file) => claimed.has(file.path));
    const configured = coverageReport(session);
    const coverageFindings: Finding[] =
        session.policyFiles.policy.coverage.strict && options.stage !== 'message'
            ? configured.unchecked.map((entry) => ({
                  check: 'coverage.strict',
                  file: entry.path,
                  message: 'No enabled check claims this supported source file.',
                  help: 'Run gspot doctor to inspect coverage and enable a check for this file.',
                  fixable: false,
              }))
            : [];
    const report: RunReport = {
        ...(options.comparison === undefined ? {} : { comparison: options.comparison }),
        version: session.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks: results,
        ignores: ignoreRows(uses),
        skips: skipRows(planned),
        coverage: {
            checked: checkedSources.length,
            unchecked: configured.unchecked.length,
            findings: coverageFindings,
        },
        suppressions: census(session, checkedSources),
        unstaged: 0,
        narrowed: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: unable ? 2 : failed.length > 0 || coverageFindings.length > 0 ? 1 : 0,
    };
    if (!options.isDryRun && options.stage !== 'message') writeReport(session.root, report);
    if (!options.isDryRun && options.noCache !== true && options.stage === 'all' && !report.narrowed)
        pruneCache(session.cacheRoot ?? session.root);
    return fixes ? { report, planned, fixes } : { report, planned };
}

export type RunOptions = PlanOptions & {
    onResult?: (result: CheckResult) => void;
    fix: boolean;
    isDryRun: boolean;
    noCache?: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    cancelSignal?: AbortSignal;
};

export type RunOutcome = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };
