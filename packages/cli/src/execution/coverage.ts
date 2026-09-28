import { scopeOf } from '#cli/repository/scopes.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
// Unchecked and partial files: what no configuration claims, and what falls short of its required check kinds.
import { claimants, claimedByClaims } from '#cli/configurations/claims.ts';
import { SOURCE_COVERAGE_KINDS } from '#cli/constants/execution/execution.ts';
import type { Session, CoverageReport } from '#cli/types/execution/execution.ts';
import { claimedInputs, configuredChecks } from '#cli/execution/planning/plan.ts';

function endingCoverage(session: Session, provided: Map<string, Set<string>>): CoverageReport['endings'] {
    const groups = new Map<string, CoverageReport['endings'][number]>();
    for (const file of session.repository.files) {
        if (file.nature !== 'source') continue;
        const ending = extensionOf(file.path);
        const scope = scopeOf(file.path, session.repository.scopes).path;
        const kinds = [...SOURCE_COVERAGE_KINDS].filter((kind) => provided.get(file.path)?.has(kind) === true);
        const key = JSON.stringify([scope, ending, kinds]);
        const group = groups.get(key) ?? { ending, scope, kinds, files: 0 };
        group.files += 1;
        groups.set(key, group);
    }
    return [...groups.values()].toSorted(
        (left, right) =>
            left.scope.localeCompare(right.scope) ||
            left.ending.localeCompare(right.ending) ||
            left.kinds.join(',').localeCompare(right.kinds.join(',')),
    );
}

function coverSource(
    session: Session,
    file: TrackedFile,
    report: CoverageReport,
    provided: Map<string, Set<string>>,
    supported: Set<string>,
): void {
    const scope = scopeOf(file.path, session.repository.scopes);
    const selection = session.scopes.find((entry) => entry.scope.path === scope.path) ?? session.scopes[0];
    const owners = selection === undefined ? [] : claimants(file, selection.selected);
    const kinds = provided.get(file.path);
    if (kinds === undefined) {
        if (!supported.has(file.path)) return;
        report.unchecked.push({
            path: file.path,
            reason: 'no enabled check claims it',
            remedy: 'gspot set generated <path>, gspot set vendored <path>, or gspot add <configuration>',
        });
        return;
    }
    report.checked += 1;
    const extension = extensionOf(file.path);
    const required = new Set(owners.flatMap((owner) => owner.coverage[extension] ?? []));
    if (required.size === 0) return;
    const missing = required.difference(kinds).values().toArray();
    if (missing.length > 0) report.partial.push({ path: file.path, missing });
}

/**
 * The coverage report for a session.
 * @param session the session
 * @returns the unchecked files, the partially checked files, and the checked count
 */
export function coverageReport(session: Session): CoverageReport {
    const report: CoverageReport = { unchecked: [], partial: [], checked: 0, endings: [] };
    const manifests = [...session.manifests.values()];
    const supported = new Set(
        manifests.flatMap((manifest) =>
            manifest.checks.flatMap((check) =>
                check.coverage.some((kind) => SOURCE_COVERAGE_KINDS.has(kind))
                    ? claimedByClaims(check.claims ?? manifest.claims, manifests, session.repository.files, '').map(
                          (file) => file.path,
                      )
                    : [],
            ),
        ),
    );
    const provided = new Map<string, Set<string>>();
    for (const check of configuredChecks(session)) {
        const coverage = new Set(check.spec.coverage);
        for (const file of claimedInputs(session, check))
            provided.set(file.path, (provided.get(file.path) ?? new Set<string>()).union(coverage));
    }
    for (const file of session.repository.files) {
        if (file.nature === 'source') coverSource(session, file, report, provided, supported);
    }
    report.endings = endingCoverage(session, provided);
    return report;
}
