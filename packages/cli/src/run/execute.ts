import { globby } from 'globby';
// The orchestrator: plan, run, filter through ignores, report, decide the exit code.
import { isActive, planRun } from '#cli/run/plan.ts';
import { applyFixers } from '#cli/run/fixers.ts';
import type { RunReport } from '#cli/output/report-types.ts';
import { writeReport } from '#cli/output/report.ts';
import { reproduceLine } from '#cli/run/reproduce.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';
import type { TrackedFile } from '#cli/repository/types.ts';
import { stageLimiter } from '#cli/run/concurrency.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import type { CheckResult, Finding } from '#cli/output/finding.ts';
import { applyIgnores, applyInlineIgnores } from '#cli/run/ignores.ts';
import { prepareCommand } from '#cli/run/tool-runner.ts';
import { textHash, cacheKey, fileHash, readCached, writeCached, pruneCache } from '#cli/run/cache.ts';

import type {
    RunHashes,
    FilterInputs,
    FixReport,
    IgnoreUse,
    RunOptions,
    RunOutcome,
    Session,
    PlannedCheck,
    Sifted,
} from '#cli/run/types.ts';

const NEVER_CACHED = new Set(['integrity/generated-drift', 'commits/commitlint', 'commits/range']);
const RAN_STATUSES = new Set(['ok', 'cache', 'fail']);
const FAILED_STATUSES = new Set(['fail', 'missing', 'error']);
const DOCKER = { name: 'docker', provider: 'host' as const, windows: true, installers: {} };

function toolVersionOf(session: Session, planned: PlannedCheck): string {
    if (!planned.tool) return 'engine';
    const { env, cwd } = prepareCommand(session, planned, planned.spec.command ?? []);
    const probe = probeTool({ ...session, cwd }, { ...planned.tool, env });
    return `${planned.tool.name}@${probe.found ?? probe.state}`;
}

function observedHash(session: Session, path: string, hashes: RunHashes): string {
    const held = hashes.files.get(path);
    if (held !== undefined) return held;
    const hash = fileHash(session.root, path);
    hashes.files.set(path, hash);
    return hash;
}

function generatedHash(session: Session, hashes: RunHashes): string {
    if (hashes.generated !== undefined) return hashes.generated;
    const files = session.repository.files
        .filter((file) => file.path.startsWith('.gspot/'))
        .filter((file) => !file.path.startsWith('.gspot/cache/') && !file.path.startsWith('.gspot/rules/'))
        .map((file) => ({ path: file.path, hash: observedHash(session, file.path, hashes) }));
    hashes.generated = JSON.stringify(files);
    return hashes.generated;
}

async function keyFor(session: Session, planned: PlannedCheck, config: RunHashes): Promise<string | undefined> {
    const declared =
        planned.manifest === undefined
            ? session.policyFiles.policy.checks.find((entry) => entry.name === planned.check)?.inputs
            : undefined;
    // Repository paths select a check, but only explicit inputs authorize caching its result.
    if (planned.manifest === undefined && declared === undefined) return undefined;
    // Built-in analyses can read undeclared files and run multiple tools. Their complete inputs are not recorded.
    if (planned.spec.engine !== undefined || planned.spec.analysis !== undefined) return undefined;
    if (NEVER_CACHED.has(planned.check) || planned.spec.requires !== undefined) return undefined;
    if (planned.spec.runs !== 'per-file-list' && planned.files.length === 0) return undefined;
    const inputs =
        declared === undefined
            ? []
            : await globby(declared, {
                  cwd: session.root,
                  dot: true,
                  onlyFiles: true,
                  followSymbolicLinks: true,
                  gitignore: false,
              });
    const paths = [...new Set([...planned.files.map((file) => file.path), ...inputs])].toSorted((left, right) =>
        left.localeCompare(right),
    );
    const files = paths.map((path) => ({ path, hash: observedHash(session, path, config) }));
    return cacheKey({
        check: planned.check,
        scope: planned.scope.scope.path,
        toolVersion: toolVersionOf(session, planned),
        configurationHash: config.policy,
        files,
        extra:
            planned.manifest === undefined ? session.version : `${session.version}\n${generatedHash(session, config)}`,
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
    const key = options.noCache === true ? undefined : await keyFor(session, planned, config);
    const cached = key === undefined ? undefined : cachedResult(session.root, key, planned);
    if (cached) return cached;
    const result = await planned.run(session, planned, staged);
    if (key !== undefined && RAN_STATUSES.has(result.status)) writeCached(session.root, key, result);
    return result;
}

function census(session: Session, files: TrackedFile[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of suppressionComments(session, files)) counts[entry.form] = (counts[entry.form] ?? 0) + 1;
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

// What is left of one result after the inline ignores and the ignores of the policy.
function withoutIgnored(
    root: string,
    sifted: Sifted,
    filtering: FilterInputs,
    uses: Map<string, IgnoreUse>,
): Finding[] {
    const inline = applyInlineIgnores(root, sifted.result.findings);
    const ignored = applyIgnores(
        inline,
        filtering.ignores.filter((entry) => entry.check === sifted.check.check),
    );
    mergeUses(uses, ignored.uses);
    return ignored.kept;
}

function filterAll(
    root: string,
    active: PlannedCheck[],
    results: CheckResult[],
    filtering: FilterInputs,
    uses: Map<string, IgnoreUse>,
    options: RunOptions,
): void {
    const paired = results.flatMap((result, index): Sifted[] => {
        const check = active[index];
        return check === undefined ? [] : [{ check, result, remaining: [] }];
    });
    const ran = paired.filter((entry) => RAN_STATUSES.has(entry.result.status));
    for (const entry of ran) entry.remaining = withoutIgnored(root, entry, filtering, uses);
    for (const { result, remaining } of ran) {
        result.findings = remaining;
        if (result.findings.length > 0) result.status = 'fail';
        else if (result.status !== 'cache') result.status = 'ok';
    }
    for (const { check, result } of paired)
        if (FAILED_STATUSES.has(result.status))
            result.reproduce = `${reproduceLine(result.check, result.scope, { stage: check.spec.stage, ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }) })}${options.comparison?.content === 'index' ? ' --staged' : ''}`;
}

function skipRows(planned: PlannedCheck[]): RunReport['skips'] {
    return planned.flatMap((check) => (check.skip ? [{ check: check.check, source: check.skip.source }] : []));
}

function failedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const corrections = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...corrections])];
}

/**
 * Runs the checks and returns the report. Writes .gspot/report.json.
 * @param opened the session
 * @param options stage, skips, fix and cache flags
 * @returns the report, the plan, and the fix report when --fix ran
 */
export async function executeRun(opened: Session, options: RunOptions): Promise<RunOutcome> {
    const session = options.cancelSignal === undefined ? opened : { ...opened, cancelSignal: options.cancelSignal };
    const started = new Date();
    const planned = await planRun(session, options);
    const fixes = options.fix ? await applyFixers(session, planned, options.isDryRun) : undefined;
    const config = { policy: textHash(session.policyFiles.text), files: new Map() };
    const staged = options.staged ? new Set(options.staged) : undefined;
    const limiter = stageLimiter();
    const active = planned.filter((check) => isActive(check));
    const results = await Promise.all(
        active.map((check) => limiter(() => runOne(session, check, options, config, staged))),
    );
    const { ignores } = session.policyFiles.policy;
    const filtering: FilterInputs = { ignores };
    const uses = new Map<string, IgnoreUse>(ignores.map((entry) => [JSON.stringify(entry), { entry, matched: 0 }]));
    filterAll(session.root, active, results, filtering, uses, options);
    const failed = failedChecks(results, fixes);
    const claimed = new Set(
        active.flatMap((check, index) =>
            RAN_STATUSES.has(results[index]!.status) ? check.files.map((file) => file.path) : [],
        ),
    );
    const sources = session.repository.files.filter((file) => file.nature === 'source');
    const checkedSources = sources.filter((file) => claimed.has(file.path));
    const report: RunReport = {
        ...(options.comparison === undefined ? {} : { comparison: options.comparison }),
        version: session.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks: results,
        ignores: ignoreRows(uses),
        skips: skipRows(planned),
        coverage: { checked: checkedSources.length, unchecked: sources.length - checkedSources.length },
        suppressions: census(session, checkedSources),
        unstaged: 0,
        narrowed: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: failed.length > 0 ? 1 : 0,
    };
    if (!options.isDryRun && options.stage !== 'message') writeReport(session.root, report);
    if (!options.isDryRun && options.noCache !== true && options.stage === 'all' && !report.narrowed)
        pruneCache(session.root);
    return fixes ? { report, planned, fixes } : { report, planned };
}
