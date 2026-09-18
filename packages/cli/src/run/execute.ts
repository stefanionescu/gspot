// The orchestrator: plan, run, filter through ignores and baselines, record, decide the exit code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SUPPRESSION_FORMS } from '#config/markers.ts';
import { textHash, cacheKey, fileHash, readCached, writeCached } from '#cli/run/cache.ts';
import { applyBaselines, readBaselines } from '#cli/run/baselines.ts';
import { stageLimiter } from '#cli/run/concurrency.ts';
import { runEngineCheck } from '#cli/run/engines.ts';
import { applyFixers } from '#cli/run/fixers.ts';
import type { FixReport } from '#cli/run/fixers.ts';
import { applyIgnores, applyInlineIgnores } from '#cli/run/ignores.ts';
import { planRun } from '#cli/run/plan.ts';
import type { PlanOptions, PlannedCheck } from '#cli/run/plan.ts';
import { writeRecord } from '#cli/run/record.ts';
import { reproduceLine } from '#cli/run/reproduce.ts';
import type { Session } from '#cli/run/session.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { probeTool } from '#cli/doctor/probes.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import type { RunRecord } from '#types/run-record.ts';

export type RunOptions = PlanOptions & { fix: boolean; dryRun: boolean; noCache?: boolean };

export type RunOutcome = { record: RunRecord; planned: PlannedCheck[]; fixes?: FixReport };

const NEVER_CACHED = new Set(['integrity/generated-drift']);

function configHash(session: Session): string {
    return textHash(session.loaded.text + JSON.stringify(session.loaded.local));
}

function keyFor(session: Session, planned: PlannedCheck, config: string): string | undefined {
    if (NEVER_CACHED.has(planned.id) || planned.spec.requires !== undefined) return undefined;
    if (planned.spec.takes === 'project' && planned.files.length === 0) return undefined;
    const files = planned.files.map((file) => ({ path: file.path, hash: fileHash(session.root, file.path) }));
    let toolVersion = 'engine';
    if (planned.tool) {
        const probe = probeTool(session.root, planned.tool);
        toolVersion = `${planned.tool.name}@${probe.found ?? probe.state}`;
    }
    const generated = session.repository.files
        .filter(
            (file) =>
                file.path.startsWith('.gspot/') &&
                !file.path.startsWith('.gspot/cache/') &&
                !file.path.startsWith('.gspot/rules/'),
        )
        .map((file) => `${file.path}:${fileHash(session.root, file.path)}`)
        .join('\n');
    return cacheKey({
        id: planned.id,
        scope: planned.scope.scope.path,
        toolVersion,
        configHash: config,
        files,
        extra: `${session.version}\n${generated}`,
    });
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
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (planned.spec.requires === 'docker') {
        const docker = probeTool(session.root, { name: 'docker', provider: 'host', windows: true, installers: {} });
        if (docker.state === 'missing')
            return { ...base, status: 'missing', note: 'this check needs a Docker daemon and docker is not installed' };
    }
    const key = options.noCache ? undefined : keyFor(session, planned, config);
    if (key) {
        const cached = readCached(session.root, key);
        if (cached)
            return {
                ...cached,
                status: cached.status === 'ok' ? 'cache' : cached.status,
                id: planned.id,
                scope: planned.scope.scope.path,
            };
    }
    const result = planned.spec.engine
        ? await runEngineCheck(session, planned, staged)
        : await runToolCheck(session, planned);
    if (key && (result.status === 'ok' || result.status === 'fail')) writeCached(session.root, key, result);
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
        for (const [form, pattern] of Object.entries(SUPPRESSION_FORMS)) {
            const matches = text.match(new RegExp(pattern.source, 'g'));
            if (matches) counts[form] = (counts[form] ?? 0) + matches.length;
        }
    }
    return counts;
}

/** Runs the checks and returns the record. Writes .gspot/last.json. */
export async function executeRun(session: Session, options: RunOptions): Promise<RunOutcome> {
    const started = new Date();
    const planned = planRun(session, options);
    let fixes: FixReport | undefined;
    if (options.fix) fixes = await applyFixers(session, planned, options.dryRun);
    const config = configHash(session);
    const staged = options.staged ? new Set(options.staged) : undefined;
    const limiter = stageLimiter();
    const active = planned.filter(
        (check) =>
            check.files.length > 0 ||
            (check.spec.takes === 'project' && check.files.length > 0) ||
            check.spec.stage === 'message',
    );
    const results = await Promise.all(
        active.map((check) => limiter(() => runOne(session, check, options, config, staged))),
    );
    const baselines = readBaselines(session.root);
    const ignoreUses = new Map<string, { entry: (typeof session.loaded.policy.ignores)[number]; matched: number }>();
    const verdicts: RunRecord['baselines'] = [];
    const failed: string[] = [];
    for (const [index, result] of results.entries()) {
        const check = active[index]!;
        if (result.status === 'ok' || result.status === 'cache' || result.status === 'fail') {
            let findings: Finding[] = applyInlineIgnores(session.root, result.findings);
            const ignored = applyIgnores(
                findings,
                session.loaded.policy.ignores.filter((entry) => entry.check === check.id),
            );
            findings = ignored.kept;
            for (const use of ignored.uses) {
                const key = JSON.stringify(use.entry);
                const existing = ignoreUses.get(key) ?? { entry: use.entry, matched: 0 };
                existing.matched += use.matched;
                ignoreUses.set(key, existing);
            }
            const baselined = applyBaselines(
                findings,
                baselines.filter((baseline) => baseline.check === check.id),
                staged,
            );
            verdicts.push(...baselined.verdicts);
            result.findings = baselined.kept;
            result.baselined = baselined.baselined;
            const failing = result.findings.length > 0 || baselined.verdicts.some((verdict) => !verdict.held);
            result.status = failing ? 'fail' : result.status === 'cache' ? 'cache' : 'ok';
        }
        if (result.status === 'fail' || result.status === 'missing' || result.status === 'error') {
            failed.push(result.id);
            result.reproduce = reproduceLine(result.id, result.scope, check.spec.stage);
        }
    }
    const skips: RunRecord['skips'] = planned
        .filter((check) => check.skip)
        .map((check) => ({ check: check.id, source: check.skip!.source }));
    for (const entry of session.loaded.policy.ignores)
        if (!ignoreUses.has(JSON.stringify(entry))) ignoreUses.set(JSON.stringify(entry), { entry, matched: 0 });
    const claimed = new Set(planned.flatMap((check) => check.files.map((file) => file.path)));
    const sources = session.repository.files.filter((file) => file.nature === 'source');
    const record: RunRecord = {
        version: session.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        root: session.root,
        checks: results,
        baselines: verdicts,
        ignores: [...ignoreUses.values()].map(({ entry, matched }) => ({
            check: entry.check,
            ...(entry.rule ? { rule: entry.rule } : {}),
            ...(entry.paths ? { paths: entry.paths } : {}),
            reason: entry.reason,
            matched,
        })),
        skips,
        coverage: {
            checked: sources.filter((file) => claimed.has(file.path)).length,
            unchecked: sources.filter((file) => !claimed.has(file.path)).length,
            partial: 0,
        },
        suppressions: census(
            session,
            sources.filter((file) => claimed.has(file.path)),
        ),
        unstaged: 0,
        failed: [...new Set(failed)],
        exitCode: failed.length > 0 ? 1 : 0,
    };
    if (!options.dryRun) writeRecord(session.root, record);
    return fixes ? { record, planned, fixes } : { record, planned };
}
