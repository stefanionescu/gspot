import { scopeOf } from '#cli/repository/scopes.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import type { Session } from '#cli/execution/session.ts';
import type { ScopeSelection } from '#cli/policy/resolve.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import { claimedInputs, configuredChecks } from '#cli/execution/plan.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
// Unchecked and partial files: what no configuration claims, and what falls short of its required check kinds.
import { claimants, claimedByClaims } from '#cli/configurations/claims.ts';

const CORE_KINDS = new Set(['format', 'syntax', 'style', 'types']);

function supportedSources(session: Session): Set<string> {
    const manifests = [...session.manifests.values()];
    return new Set(
        manifests.flatMap((manifest) =>
            manifest.checks.flatMap((check) =>
                check.coverage.some((kind) => CORE_KINDS.has(kind))
                    ? claimedByClaims(check.claims ?? manifest.claims, manifests, session.repository.files, '').map(
                          (file) => file.path,
                      )
                    : [],
            ),
        ),
    );
}

function selectionFor(session: Session, file: TrackedFile): ScopeSelection | undefined {
    const scope = scopeOf(file.path, session.repository.scopes);
    return session.scopes.find((entry) => entry.scope.path === scope.path) ?? session.scopes[0];
}

function requiredKinds(owners: Manifest[], extension: string): Set<string> {
    return new Set(owners.flatMap((owner) => owner.coverage[extension] ?? []));
}

function endingCoverage(session: Session, provided: Map<string, Set<string>>): CoverageReport['endings'] {
    const groups = new Map<string, CoverageReport['endings'][number]>();
    for (const file of session.repository.files) {
        if (file.nature !== 'source') continue;
        const ending = extensionOf(file.path);
        const scope = scopeOf(file.path, session.repository.scopes).path;
        const kinds = [...CORE_KINDS].filter((kind) => provided.get(file.path)?.has(kind) === true);
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
    const selection = selectionFor(session, file);
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
    const required = requiredKinds(owners, extensionOf(file.path));
    if (required.size === 0) return;
    const missing = required.difference(kinds).values().toArray();
    if (missing.length > 0) report.partial.push({ path: file.path, missing });
}

/**
 * The coverage report for a session.
 * @param session the session
 * @returns the unchecked files, the partially checked files and the checked count
 */
export function coverageReport(session: Session): CoverageReport {
    const report: CoverageReport = { unchecked: [], partial: [], checked: 0, endings: [] };
    const supported = supportedSources(session);
    const provided = new Map<string, Set<string>>();
    for (const check of configuredChecks(session)) {
        for (const file of claimedInputs(session, check)) {
            const kinds = provided.get(file.path) ?? new Set<string>();
            for (const kind of check.spec.coverage) kinds.add(kind);
            provided.set(file.path, kinds);
        }
    }
    for (const file of session.repository.files) {
        if (file.nature === 'source') coverSource(session, file, report, provided, supported);
    }
    report.endings = endingCoverage(session, provided);
    return report;
}

export type CoverageReport = {
    endings: { ending: string; scope: string; files: number; kinds: string[] }[];
    unchecked: { path: string; reason: string; remedy?: string }[];
    partial: { path: string; missing: string[] }[];
    checked: number;
};
