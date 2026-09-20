// The orchestrator: plan, run, filter through ignores and baselines, record, decide the exit code.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { planRun } from '#cli/run/plan.ts';
import { applyFixers } from '#cli/run/fixers.ts';
import type { RunRecord } from '#types/record.ts';
import { runEngineCheck } from '#cli/run/engines.ts';
import { reproduceLine } from '#cli/run/reproduce.ts';
import { SUPPRESSION_FORMS } from '#config/markers.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { stageLimiter } from '#cli/run/concurrency.ts';
import { writeRecord } from '#cli/run/record/write.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import { toolBaselineFile } from '#cli/run/scope-paths.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import { applyBaselines, readBaselines } from '#cli/run/baselines.ts';
import { applyIgnores, applyInlineIgnores } from '#cli/run/ignores.ts';
import { textHash, cacheKey, fileHash, readCached, writeCached } from '#cli/run/cache.ts';
import type { FilterInputs, IgnoreUse, RunOptions, RunOutcome, Session, PlannedCheck, Sifted } from '#types/run.ts';

const NEVER_CACHED = new Set(['integrity/generated-drift', 'commits/commitlint', 'commits/range']);
const RAN_STATUSES = new Set(['ok', 'cache', 'fail']);
const FAILED_STATUSES = new Set(['fail', 'missing', 'error']);
const DOCKER = { name: 'docker', provider: 'host' as const, windows: true, installers: {} };

function configurationHash(session: Session): string {
    return textHash(session.policyFiles.text + JSON.stringify(session.policyFiles.local));
}

function toolVersionOf(session: Session, planned: PlannedCheck): string {
    if (!planned.tool) return 'engine';
    const probe = probeTool(session.root, planned.tool);
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
    return file === undefined ? '' : fileHash(session.root, toolBaselineFile(file, planned.scope.scope.path));
}

function keyFor(session: Session, planned: PlannedCheck, config: string): string | undefined {
    // Repository paths select a check, but do not declare everything its command reads.
    if (planned.manifest === undefined) return undefined;
    if (NEVER_CACHED.has(planned.id) || planned.spec.requires !== undefined) return undefined;
    if (planned.spec.runs !== 'per-file-list' && planned.files.length === 0) return undefined;
    const files = planned.files.map((file) => ({ path: file.path, hash: fileHash(session.root, file.path) }));
    return cacheKey({
        id: planned.id,
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
    return { ...cached, status, id: planned.id, scope: planned.scope.scope.path };
}

function freshResult(session: Session, planned: PlannedCheck, staged: Set<string> | undefined): Promise<CheckResult> {
    return planned.spec.engine === undefined
        ? runToolCheck(session, planned)
        : runEngineCheck(session, planned, staged);
}

function unrunnable(session: Session, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (planned.spec.requires === 'docker' && probeTool(session.root, DOCKER).state === 'missing')
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
        id: planned.id,
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
        let text: string;
        try {
            text = readFileSync(join(session.root, file.path), 'utf8');
        } catch {
            continue;
        }
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

function ignoreRows(uses: Map<string, IgnoreUse>): RunRecord['ignores'] {
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
        filtering.ignores.filter((entry) => entry.check === sifted.check.id),
    );
    mergeUses(uses, ignored.uses);
    return ignored.kept;
}

// A baseline holds the count of a rule over the whole repository, so the findings of every scope are counted together.
// Counted scope by scope, each scope grows up to the whole count and the gate still passes.
function heldByCheck(ran: Sifted[], filtering: FilterInputs): Map<string, ReturnType<typeof applyBaselines>> {
    const ids = new Set(ran.map((entry) => entry.check.id));
    return new Map(
        ids.values().map((id): [string, ReturnType<typeof applyBaselines>] => [
            id,
            applyBaselines(
                ran.filter((entry) => entry.check.id === id).flatMap((entry) => entry.remaining),
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
): RunRecord['baselines'] {
    const paired = results.flatMap((result, index): Sifted[] => {
        const check = active[index];
        return check === undefined ? [] : [{ check, result, remaining: [] }];
    });
    const ran = paired.filter((entry) => RAN_STATUSES.has(entry.result.status));
    for (const entry of ran) entry.remaining = withoutIgnored(root, entry, filtering, uses);
    const held = heldByCheck(ran, filtering);
    for (const { check, result, remaining } of ran) {
        const kept = new Set(held.get(check.id)?.kept);
        result.findings = remaining.filter((finding) => kept.has(finding));
        result.baselined = remaining.length - result.findings.length;
        if (result.findings.length > 0) result.status = 'fail';
        else if (result.status !== 'cache') result.status = 'ok';
    }
    for (const { check, result } of paired)
        if (FAILED_STATUSES.has(result.status))
            result.reproduce = reproduceLine(result.id, result.scope, check.spec.stage);
    return held
        .values()
        .flatMap((outcome) => outcome.verdicts)
        .toArray();
}

function isActive(check: PlannedCheck): boolean {
    return check.files.length > 0 || check.spec.stage === 'message';
}

function skipRows(planned: PlannedCheck[]): RunRecord['skips'] {
    return planned.flatMap((check) => (check.skip ? [{ check: check.id, source: check.skip.source }] : []));
}

/**
 * Runs the checks and returns the record. Writes .gspot/last.json.
 * @param session the session
 * @param options stage, skips, fix and cache flags
 * @returns the record, the plan, and the fix report when --fix ran
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
    const failed = [
        ...new Set(results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.id)),
    ];
    const claimed = new Set(planned.flatMap((check) => check.files.map((file) => file.path)));
    const sources = session.repository.files.filter((file) => file.nature === 'source');
    const checkedSources = sources.filter((file) => claimed.has(file.path));
    const record: RunRecord = {
        version: session.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        root: session.root,
        checks: results,
        baselines: verdicts,
        ignores: ignoreRows(uses),
        skips: skipRows(planned),
        inspection: { checked: checkedSources.length, unchecked: sources.length - checkedSources.length },
        suppressions: census(session, checkedSources),
        unstaged: 0,
        narrowed: options.staged !== undefined || options.since !== undefined,
        failed,
        exitCode: failed.length > 0 ? 1 : 0,
    };
    if (!options.isDryRun) writeRecord(session.root, record);
    return fixes ? { record, planned, fixes } : { record, planned };
}
