// gspot's count files under .gspot/baseline/; the verdict against them; apply --baseline.
import { join } from 'node:path';
import type { Finding } from '#types/finding.ts';
import type { BaselineVerdict } from '#types/record.ts';
import type { BaselineFile, RuleCount } from '#types/run.ts';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const NEVER_BASELINED = new Set(['format', 'syntax', 'schema']);
const FOREIGN_FILES = new Set(['eslint.json', 'basedpyright.json']);
const DATE_LENGTH = 10;
const JSON_INDENT = 4;
const UNSAFE_RULE_CHARS = /[^\w.-]/gu;

function dir(root: string): string {
    return join(root, '.gspot', 'baseline');
}

function fileName(check: string, rule: string): string {
    return `${check.replace('/', '.')}.${rule.replaceAll(UNSAFE_RULE_CHARS, '_')}.json`;
}

function keyOf(check: string, rule: string | undefined): string {
    return `${check}\n${rule ?? 'all'}`;
}

function readBaseline(path: string): BaselineFile | undefined {
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as BaselineFile;
    } catch {
        return undefined;
    }
}

function isGrowthStaged(current: RuleCount, baseline: BaselineFile, stagedPaths: Set<string>): boolean {
    return Object.entries(current.paths).some(
        ([path, perFile]) => stagedPaths.has(path) && perFile > (baseline.paths[path] ?? 0),
    );
}

function verdictFor(
    baseline: BaselineFile,
    current: RuleCount | undefined,
    stagedPaths?: Set<string>,
): BaselineVerdict {
    const count = current?.count ?? 0;
    const isWithinCount = count <= baseline.count;
    const isGrown =
        current !== undefined && stagedPaths !== undefined && isGrowthStaged(current, baseline, stagedPaths);
    return {
        check: baseline.check,
        rule: baseline.rule,
        count,
        baseline: baseline.count,
        held: isWithinCount && !isGrown,
    };
}

function writeBaseline(root: string, file: BaselineFile): void {
    mkdirSync(dir(root), { recursive: true });
    writeFileSync(join(dir(root), fileName(file.check, file.rule)), `${JSON.stringify(file, null, JSON_INDENT)}\n`);
}

/**
 * Every baseline file present.
 * @param root the repository root
 * @returns the files, in name order
 */
export function readBaselines(root: string): BaselineFile[] {
    const folder = dir(root);
    if (!existsSync(folder)) return [];
    return readdirSync(folder)
        .toSorted((a, b) => a.localeCompare(b))
        .filter((name) => name.endsWith('.json') && !FOREIGN_FILES.has(name))
        .map((name) => readBaseline(join(folder, name)))
        .filter((file) => file !== undefined);
}

/**
 * Groups findings by check and rule, with counts per path.
 * @param findings the findings
 * @returns the counts, keyed by check and rule
 */
export function countByRule(findings: Finding[]): Map<string, RuleCount> {
    const counts = new Map<string, RuleCount>();
    for (const finding of findings) {
        const rule = finding.rule ?? 'all';
        const key = keyOf(finding.check, rule);
        const entry = counts.get(key) ?? { check: finding.check, rule, count: 0, paths: {} };
        entry.count += 1;
        entry.paths[finding.file] = (entry.paths[finding.file] ?? 0) + 1;
        counts.set(key, entry);
    }
    return counts;
}

/**
 * True when a check's findings may enter a baseline. Format, syntax and schema findings never do.
 * @param inspection the check's inspection kinds
 * @returns whether a baseline is allowed
 */
export function isBaselineAllowed(inspection: string[]): boolean {
    return inspection.every((kind) => !NEVER_BASELINED.has(kind));
}

/**
 * Writes one baseline file per rule with findings, for init and upgrade.
 * @param root the repository root
 * @param findings the findings of the run
 * @param isAllowed tells whether a check may be baselined
 * @returns the files written
 */
export function writeBaselines(
    root: string,
    findings: Finding[],
    isAllowed: (check: string) => boolean,
): BaselineFile[] {
    const today = new Date().toISOString().slice(0, DATE_LENGTH);
    const written: BaselineFile[] = [];
    for (const entry of countByRule(findings).values()) {
        if (!isAllowed(entry.check)) continue;
        const file: BaselineFile = {
            check: entry.check,
            rule: entry.rule,
            count: entry.count,
            recorded: today,
            paths: entry.paths,
        };
        writeBaseline(root, file);
        written.push(file);
    }
    return written;
}

/**
 * Applies baselines: findings covered by a held baseline are removed; a count that rose keeps every finding. Per-file growth fails in staged mode.
 * @param findings the findings of one check
 * @param baselines the baseline files for that check
 * @param stagedPaths the staged paths, in staged mode
 * @returns the findings kept, the verdict per baseline, and how many findings a baseline covered
 */
export function applyBaselines(
    findings: Finding[],
    baselines: BaselineFile[],
    stagedPaths?: Set<string>,
): { kept: Finding[]; verdicts: BaselineVerdict[]; baselined: number } {
    const counts = countByRule(findings);
    const verdicts = baselines.map((baseline) =>
        verdictFor(baseline, counts.get(keyOf(baseline.check, baseline.rule)), stagedPaths),
    );
    const covered = new Set(
        verdicts.filter((verdict) => verdict.held).map((verdict) => keyOf(verdict.check, verdict.rule)),
    );
    const baselined = verdicts.filter((verdict) => verdict.held).reduce((sum, verdict) => sum + verdict.count, 0);
    const kept = findings.filter((finding) => !covered.has(keyOf(finding.check, finding.rule)));
    return { kept, verdicts, baselined };
}

/**
 * Lowers every baseline to the last run's counts; never raises one; removes files for rules with no findings and rules that no longer exist.
 * @param root the repository root
 * @param findings the findings of the last run
 * @param existingChecks the ids of the checks that still exist
 * @returns which baselines were lowered, removed, or refused because the count rose
 */
export function lowerBaselines(
    root: string,
    findings: Finding[],
    existingChecks: Set<string>,
): { lowered: string[]; removed: string[]; rose: string[] } {
    const counts = countByRule(findings);
    const lowered: string[] = [];
    const removed: string[] = [];
    const rose: string[] = [];
    for (const baseline of readBaselines(root)) {
        const name = `${baseline.check}:${baseline.rule}`;
        const current = counts.get(keyOf(baseline.check, baseline.rule));
        if (!current || !existingChecks.has(baseline.check)) {
            rmSync(join(dir(root), fileName(baseline.check, baseline.rule)), { force: true });
            removed.push(name);
        } else if (current.count > baseline.count) rose.push(name);
        else if (current.count < baseline.count || JSON.stringify(current.paths) !== JSON.stringify(baseline.paths)) {
            writeBaseline(root, { ...baseline, count: current.count, paths: current.paths });
            lowered.push(name);
        }
    }
    return { lowered, removed, rose };
}
