// Unchecked and partial files: what no preset claims, and what falls short of its required inspections.
import type { Manifest } from '#types/manifest.ts';
import { claimants } from '#cli/presets/claims.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import type { CoverageReport } from '#types/doctor.ts';
import type { TrackedFile } from '#types/repository.ts';
import type { ScopeSelection, Session } from '#types/run.ts';

function selectionFor(session: Session, file: TrackedFile): ScopeSelection | undefined {
    const scope = scopeOf(file.path, session.repository.scopes);
    return session.scopes.find((entry) => entry.scope.path === scope.path) ?? session.scopes[0];
}

function requiredKinds(owners: Manifest[], extension: string): Set<string> {
    return new Set(owners.flatMap((owner) => owner.required[extension] ?? []));
}

function providedKinds(selected: Manifest[]): Set<string> {
    return new Set(selected.flatMap((manifest) => manifest.checks.flatMap((check) => check.inspection)));
}

function coverSource(session: Session, file: TrackedFile, report: CoverageReport): void {
    const selection = selectionFor(session, file);
    const owners = selection === undefined ? [] : claimants(file, selection.selected);
    if (selection === undefined || owners.length === 0) {
        report.unchecked.push({
            path: file.path,
            reason: 'no preset claims it',
            remedy: 'gspot declare, or gspot add <preset>',
        });
        return;
    }
    report.checked += 1;
    const required = requiredKinds(owners, extensionOf(file.path));
    if (required.size === 0) return;
    const missing = required.difference(providedKinds(selection.selected)).values().toArray();
    if (missing.length > 0) report.partial.push({ path: file.path, missing });
}

/**
 * The coverage report for a session.
 * @param session the session
 * @returns the unchecked files, the partially checked files and the checked count
 */
export function coverageReport(session: Session): CoverageReport {
    const report: CoverageReport = { unchecked: [], partial: [], checked: 0 };
    for (const file of session.repository.files) {
        if (file.nature === 'binary') report.unchecked.push({ path: file.path, reason: 'binary: secrets scan only' });
        else if (file.nature === 'source') coverSource(session, file, report);
        else report.checked += 1;
    }
    return report;
}
