// gspot's count files under .gspot/baseline/; the verdict against them; sync --baseline.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from '#types/finding.ts';
import type { BaselineVerdict } from '#types/run-record.ts';

export type BaselineFile = {
    check: string;
    rule: string;
    count: number;
    recorded: string;
    paths: Record<string, number>;
};

const NEVER_BASELINED = ['format', 'syntax', 'schema'];

function dir(root: string): string {
    return join(root, '.gspot', 'baseline');
}

function fileName(check: string, rule: string): string {
    return `${check.replace('/', '.')}.${rule.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`;
}

/** Every baseline file present. */
export function readBaselines(root: string): BaselineFile[] {
    const folder = dir(root);
    if (!existsSync(folder)) return [];
    const files: BaselineFile[] = [];
    for (const name of readdirSync(folder).sort()) {
        if (!name.endsWith('.json') || name === 'eslint.json' || name === 'basedpyright.json') continue;
        try {
            files.push(JSON.parse(readFileSync(join(folder, name), 'utf8')) as BaselineFile);
        } catch {
            // an unreadable baseline is reported by integrity/baselines-current
        }
    }
    return files;
}

/** Groups findings by check and rule, with counts per path. */
export function countByRule(
    findings: Finding[],
): Map<string, { check: string; rule: string; count: number; paths: Record<string, number> }> {
    const counts = new Map<string, { check: string; rule: string; count: number; paths: Record<string, number> }>();
    for (const finding of findings) {
        const rule = finding.rule ?? 'all';
        const key = `${finding.check}\n${rule}`;
        const entry = counts.get(key) ?? { check: finding.check, rule, count: 0, paths: {} };
        entry.count += 1;
        entry.paths[finding.file] = (entry.paths[finding.file] ?? 0) + 1;
        counts.set(key, entry);
    }
    return counts;
}

/** True when a check's findings may enter a baseline. Format, syntax and schema findings never do. */
export function baselineAllowed(inspection: string[]): boolean {
    return !inspection.some((kind) => NEVER_BASELINED.includes(kind));
}

/** Writes one baseline file per rule with findings, for init and upgrade. */
export function writeBaselines(root: string, findings: Finding[], allowed: (check: string) => boolean): BaselineFile[] {
    const written: BaselineFile[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of countByRule(findings).values()) {
        if (!allowed(entry.check)) continue;
        const file: BaselineFile = {
            check: entry.check,
            rule: entry.rule,
            count: entry.count,
            recorded: today,
            paths: entry.paths,
        };
        mkdirSync(dir(root), { recursive: true });
        writeFileSync(join(dir(root), fileName(entry.check, entry.rule)), `${JSON.stringify(file, null, 4)}\n`);
        written.push(file);
    }
    return written;
}

/** Applies baselines: findings covered by a held baseline are removed; a count that rose keeps every finding. Per-file growth fails in staged mode. */
export function applyBaselines(
    findings: Finding[],
    baselines: BaselineFile[],
    stagedPaths?: Set<string>,
): { kept: Finding[]; verdicts: BaselineVerdict[]; baselined: number } {
    const counts = countByRule(findings);
    const verdicts: BaselineVerdict[] = [];
    const kept: Finding[] = [];
    let baselined = 0;
    const covered = new Set<string>();
    for (const baseline of baselines) {
        const key = `${baseline.check}\n${baseline.rule}`;
        const current = counts.get(key);
        const count = current?.count ?? 0;
        let held = count <= baseline.count;
        if (held && stagedPaths && current) {
            for (const [path, perFile] of Object.entries(current.paths)) {
                if (stagedPaths.has(path) && perFile > (baseline.paths[path] ?? 0)) held = false;
            }
        }
        verdicts.push({ check: baseline.check, rule: baseline.rule, count, baseline: baseline.count, held });
        if (held) {
            covered.add(key);
            baselined += count;
        }
    }
    for (const finding of findings) {
        const key = `${finding.check}\n${finding.rule ?? 'all'}`;
        if (!covered.has(key)) kept.push(finding);
    }
    return { kept, verdicts, baselined };
}

/** Lowers every baseline to the last run's counts; never raises one; removes files for rules with no findings and rules that no longer exist. */
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
        const key = `${baseline.check}\n${baseline.rule}`;
        const current = counts.get(key);
        const path = join(dir(root), fileName(baseline.check, baseline.rule));
        if (!existingChecks.has(baseline.check) || !current) {
            rmSync(path, { force: true });
            removed.push(`${baseline.check}:${baseline.rule}`);
            continue;
        }
        if (current.count > baseline.count) {
            rose.push(`${baseline.check}:${baseline.rule}`);
            continue;
        }
        if (current.count < baseline.count || JSON.stringify(current.paths) !== JSON.stringify(baseline.paths)) {
            writeFileSync(
                path,
                `${JSON.stringify({ ...baseline, count: current.count, paths: current.paths }, null, 4)}\n`,
            );
            lowered.push(`${baseline.check}:${baseline.rule}`);
        }
    }
    return { lowered, removed, rose };
}
