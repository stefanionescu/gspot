// Unchecked and partial files: what no preset claims, and what falls short of its required inspections.
import { extensionOf } from '#cli/platform/paths.ts';
import { claimants } from '#cli/presets/claims.ts';
import type { Session } from '#cli/run/session.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { CoverageReport } from '#types/doctor.ts';

/** The coverage report for a session. */
export function coverageReport(session: Session): CoverageReport {
    const report: CoverageReport = { unchecked: [], partial: [], checked: 0 };
    for (const file of session.repository.files) {
        if (file.nature === 'binary') {
            report.unchecked.push({ path: file.path, reason: 'binary: secrets scan only' });
            continue;
        }
        if (file.nature !== 'source') {
            report.checked += 1;
            continue;
        }
        const scope = scopeOf(file.path, session.repository.scopes);
        const selection = session.scopes.find((entry) => entry.scope.path === scope.path) ?? session.scopes[0]!;
        const owners = claimants(file, selection.selected);
        if (owners.length === 0) {
            report.unchecked.push({
                path: file.path,
                reason: 'no preset claims it',
                remedy: 'gspot declare, or gspot add <preset>',
            });
            continue;
        }
        report.checked += 1;
        const ext = extensionOf(file.path);
        const required = new Set<string>();
        for (const owner of owners) for (const kind of owner.required[ext] ?? []) required.add(kind);
        if (required.size === 0) continue;
        const provided = new Set<string>();
        for (const manifest of selection.selected)
            for (const check of manifest.checks) for (const kind of check.inspection) provided.add(kind);
        const missing = [...required].filter((kind) => !provided.has(kind));
        if (missing.length > 0) report.partial.push({ path: file.path, missing });
    }
    return report;
}
