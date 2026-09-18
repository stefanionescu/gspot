// why <path>: the presets that claim a file, the checks that run on it, the baselines and ignores that touch it.
import { claimants, claimedByClaims, pathMatcher } from '#cli/presets/claims.ts';
import { readBaselines } from '#cli/run/baselines.ts';
import type { Session } from '#cli/run/session.ts';
import { scopeOf } from '#cli/repository/scopes.ts';

export type WhyReport = {
    path: string;
    scope: string;
    nature: string;
    natureSource?: string;
    tags: string[];
    presets: string[];
    checks: { id: string; stage: string; preset: string }[];
    baselines: { check: string; rule: string; count: number }[];
    ignores: { check: string; rule?: string; reason: string }[];
    unchecked?: string;
    remedy?: string;
};

/** Explains one file. */
export function why(session: Session, path: string): WhyReport | { error: string } {
    const file = session.repository.files.find((entry) => entry.path === path);
    if (!file) return { error: `${path} is not a file git tracks or would track here.` };
    const scope = scopeOf(path, session.repository.scopes);
    const selection = session.scopes.find((entry) => entry.scope.path === scope.path) ?? session.scopes[0]!;
    const report: WhyReport = {
        path,
        scope: scope.path === '' ? 'root' : scope.path,
        nature: file.nature,
        tags: file.tags,
        presets: [],
        checks: [],
        baselines: [],
        ignores: [],
    };
    if (file.natureSource) report.natureSource = file.natureSource;
    if (file.nature === 'binary') {
        report.unchecked = 'binary: the secrets scan runs over it and nothing else';
        return report;
    }
    if (file.nature === 'generated')
        report.unchecked = `generated${file.producedBy ? ` by ${file.producedBy}` : ''}: secrets and freshness checks only`;
    if (file.nature === 'vendored') report.unchecked = 'vendored: secrets, licenses and vulnerabilities checks only';
    const owners = claimants(file, selection.selected);
    report.presets = owners.map((manifest) => manifest.preset.id);
    for (const manifest of owners) {
        for (const check of manifest.checks) {
            if (check.claims && claimedByClaims(check.claims, selection.selected, [file], scope.path).length === 0)
                continue;
            report.checks.push({ id: check.id, stage: check.stage, preset: manifest.preset.id });
        }
    }
    for (const baseline of readBaselines(session.root))
        if (baseline.paths[path] !== undefined)
            report.baselines.push({ check: baseline.check, rule: baseline.rule, count: baseline.paths[path]! });
    for (const entry of session.loaded.policy.ignores)
        if (entry.paths && pathMatcher(entry.paths)(path))
            report.ignores.push({
                check: entry.check,
                ...(entry.rule ? { rule: entry.rule } : {}),
                reason: entry.reason,
            });
    if (owners.length === 0 && file.nature === 'source') {
        report.unchecked = 'no selected preset claims this file';
        report.remedy = 'gspot declare "<glob>" --produced-by "..." or --vendored, or gspot add <preset>';
    }
    return report;
}

/** Renders the report. */
export function renderWhy(report: WhyReport): string {
    const lines = [
        `${report.path}  (scope ${report.scope}, ${report.nature}${report.natureSource ? ` by ${report.natureSource}` : ''})`,
        '',
    ];
    if (report.unchecked) lines.push(report.unchecked);
    if (report.presets.length > 0) lines.push(`claimed by: ${report.presets.join(', ')}`);
    if (report.checks.length > 0) {
        lines.push('checks:');
        for (const check of report.checks) lines.push(`  ${check.id}  ${check.stage}  (${check.preset})`);
    }
    if (report.baselines.length > 0) {
        lines.push('baselines:');
        for (const entry of report.baselines)
            lines.push(`  ${entry.check}:${entry.rule}  ${entry.count} recorded in this file`);
    }
    if (report.ignores.length > 0) {
        lines.push('ignores:');
        for (const entry of report.ignores)
            lines.push(`  ${entry.check}${entry.rule ? ` ${entry.rule}` : ''}  ${entry.reason}`);
    }
    if (report.remedy) lines.push('', `to change this: ${report.remedy}`);
    return `${lines.join('\n')}\n`;
}
