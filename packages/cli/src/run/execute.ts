// The orchestrator: plan, run, filter through ignores and baselines, report, decide the exit code.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { planRun } from '#cli/run/plan.ts';
import { applyFixers } from '#cli/run/fixers.ts';
import type { RunReport } from '#types/report.ts';
import { writeReport } from '#cli/output/report.ts';
import { TOOL_ANALYSES } from '#cli/run/analyses.ts';
import { runEngineCheck } from '#cli/run/engines.ts';
import { reproduceLine } from '#cli/run/reproduce.ts';
import { SUPPRESSION_FORMS } from '#config/markers.ts';
import { stageLimiter } from '#cli/run/concurrency.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import { toolBaselineFile } from '#cli/run/scope-paths.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import { applyBaselines, readBaselines } from '#cli/run/baselines.ts';
import { applyIgnores, applyInlineIgnores } from '#cli/run/ignores.ts';
import { prepareCommand, runToolCheck } from '#cli/run/tool-runner.ts';
import { textHash, cacheKey, fileHash, readCached, writeCached } from '#cli/run/cache.ts';

import type {
    FilterInputs,
    FixReport,
    IgnoreUse,
    RunOptions,
    RunOutcome,
    Session,
    PlannedCheck,
    Sifted,
} from '#types/run.ts';

const NEVER_CACHED = new Set(['integrity/generated-drift', 'commits/commitlint', 'commits/range']);
const RAN_STATUSES = new Set(['ok', 'cache', 'fail']);
const FAILED_STATUSES = new Set(['fail', 'missing', 'error']);
const DOCKER = { name: 'docker', provider: 'host' as const, windows: true, installers: {} };

function configurationHash(session: Session): string {
    return textHash(session.policyFiles.text + JSON.stringify(session.policyFiles.local));
}

function toolVersionOf(session: Session, planned: PlannedCheck): string {
    if (!planned.tool) return 'engine';
    const { env } = prepareCommand(session, planned, planned.spec.command ?? []);
    const probe = probeTool(session, { ...planned.tool, env });
    return `${planned.tool.name}@${probe.found ?? probe.state}`;
}

function generatedHash(session: Session): string {
    return session.repository.files
        .filter((file) => file.path.startsWith('.gspot/'))
        .filter((file) => !file.path.startsWith('.gspot/cache/') && !file.path.startsWith('.gspot/rules/'))
        .map((file) => `${file.path}:${fileHash(session.root, file.path)}`)
        .join('\n');
}

// The tool's own baseline is an input too: a suppression added or pruned changes the verdict.
function baselineHash(session: Session, planned: PlannedCheck): string {
    const file = planned.spec.baseline_file;
    if (file === undefined) return '';
    try {
        return fileHash(session.root, toolBaselineFile(file, planned.scope.scope.path));
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return '';
        throw error;
    }
}

function keyFor(session: Session, planned: PlannedCheck, config: string): string | undefined {
    // Repository paths select a check, but do not declare everything its command reads.
    if (planned.manifest === undefined) return undefined;
    if (NEVER_CACHED.has(planned.check) || planned.spec.requires !== undefined) return undefined;
    if (planned.spec.runs !== 'per-file-list' && planned.files.length === 0) return undefined;
    const files = planned.files.map((file) => ({ path: file.path, hash: fileHash(session.root, file.path) }));
    return cacheKey({
        check: planned.check,
        scope: planned.scope.scope.path,
        toolVersion: toolVersionOf(session, planned),
        configurationHash: config,
        files,
        extra: `${session.version}\n${generatedHash(session)}\n${baselineHash(session, planned)}`,
    });
}

function cachedResult(root: string, key: string, planned: PlannedCheck): CheckResult | undefined {
    const cached = readCached(root, key);
    if (!cached) return undefined;
    const status = cached.status === 'ok' ? 'cache' : cached.status;
    return { ...cached, status, check: planned.check, scope: planned.scope.scope.path };
}

function freshResult(session: Session, planned: PlannedCheck, staged: Set<string> | undefined): Promise<CheckResult> {
    if (planned.spec.engine !== undefined) return runEngineCheck(session, planned.spec.engine, planned, staged);
    const analysis = TOOL_ANALYSES[planned.spec.analysis ?? ''];
    return analysis === undefined ? runToolCheck(session, planned) : analysis(session, planned);
}

function unrunnable(session: Session, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (planned.spec.requires === 'docker' && probeTool(session, DOCKER).state === 'missing')
        return { ...base, status: 'missing', note: 'this check needs a Docker daemon and docker is not installed' };
    return undefined;
}

async function runOne(
    session: Session,
    planned: PlannedCheck,
    options: RunOptions,
    config: string,
    staged?: Set<string>,
): Promise<CheckResult> {
    const base: CheckResult = {
        check: planned.check,
        scope: planned.scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
        baselined: 0,
    };
    const early = unrunnable(session, planned, base);
    if (early) return early;
    const key = options.noCache === true ? undefined : keyFor(session, planned, config);
    const cached = key === undefined ? undefined : cachedResult(session.root, key, planned);
    if (cached) return cached;
    const result = await freshResult(session, planned, staged);
    if (key !== undefined && RAN_STATUSES.has(result.status)) writeCached(session.root, key, result);
    return result;
}

function census(session: Session, files: { path: string }[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const file of files) {
        const text = readFileSync(join(session.root, file.path), 'utf8');
        const forms = Object.entries(SUPPRESSION_FORMS);
        for (const [form, { marker }] of forms) {
            const count = text.matchAll(new RegExp(marker.source, 'gu')).toArray().length;
            if (count > 0) counts[form] = (counts[form] ?? 0) + count;
        }
    }
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
            reason: entry.reason,
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

// A baseline holds the count of a rule over the whole repository, so the findings of every scope are counted together.
// Counted scope by scope, each scope grows up to the whole count and the gate still passes.
function heldByCheck(ran: Sifted[], filtering: FilterInputs): Map<string, ReturnType<typeof applyBaselines>> {
    const ids = new Set(ran.map((entry) => entry.check.check));
    return new Map(
        ids.values().map((id): [string, ReturnType<typeof applyBaselines>] => [
            id,
            applyBaselines(
                ran.filter((entry) => entry.check.check === id).flatMap((entry) => entry.remaining),
                filtering.baselines.filter((baseline) => baseline.check === id),
                filtering.staged,
            ),
        ]),
    );
}

function filterAll(
    root: string,
    active: PlannedCheck[],
    results: CheckResult[],
    filtering: FilterInputs,
    uses: Map<string, IgnoreUse>,
): RunReport['baselines'] {
    const paired = results.flatMap((result, index): Sifted[] => {
        const check = active[index];
        return check === undefined ? [] : [{ check, result, remaining: [] }];
    });
    const ran = paired.filter((entry) => RAN_STATUSES.has(entry.result.status));
    for (const entry of ran) entry.remaining = withoutIgnored(root, entry, filtering, uses);
    const held = heldByCheck(ran, filtering);
    for (const { check, result, remaining } of ran) {
        const kept = new Set(held.get(check.check)?.kept);
        result.findings = remaining.filter((finding) => kept.has(finding));
        result.baselined = remaining.length - result.findings.length;
        if (result.findings.length > 0) result.status = 'fail';
        else if (result.status !== 'cache') result.status = 'ok';
    }
    for (const { check, result } of paired)
        if (FAILED_STATUSES.has(result.status))
            result.reproduce = reproduceLine(result.check, result.scope, check.spec.stage);
    return held
        .values()
        .flatMap((outcome) => outcome.verdicts)
        .toArray();
}

function isActive(check: PlannedCheck): boolean {
    return check.files.length > 0 || check.triggerPaths.length > 0 || check.spec.stage === 'message';
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
 * @param session the session
 * @param options stage, skips, fix and cache flags
 * @returns the report, the plan, and the fix report when --fix ran
 */
export async function executeRun(session: Session, options: RunOptions): Promise<RunOutcome> {
    const started = new Date();
    const planned = planRun(session, options);
    const fixes = options.fix ? await applyFixers(session, planned, options.isDryRun) : undefined;
    const config = configurationHash(session);
    const staged = options.staged ? new Set(options.staged) : undefined;
    const limiter = stageLimiter();
    const active = planned.filter((check) => isActive(check));
    const results = await Promise.all(
        active.map((check) => limiter(() => runOne(session, check, options, config, staged))),
    );
    const { ignores } = session.policyFiles.policy;
    const filtering: FilterInputs = { baselines: readBaselines(session.root), ignores, staged };
    const uses = new Map<string, IgnoreUse>(ignores.map((entry) => [JSON.stringify(entry), { entry, matched: 0 }]));
    const verdicts = filterAll(session.root, active, results, filtering, uses);
    const failed = failedChecks(results, fixes);
    const claimed = new Set(planned.flatMap((check) => check.files.map((file) => file.path)));
    const sources = session.repository.files.filter((file) => file.nature === 'source');
    const checkedSources = sources.filter((file) => claimed.has(file.path));
    const report: RunReport = {
        ...(options.comparison === undefined
            ? {}
            : { comparison: { content: 'working-tree' as const, reference: options.comparison } }),
        version: session.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks: results,
        baselines: verdicts,
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
    return fixes ? { report, planned, fixes } : { report, planned };
}
