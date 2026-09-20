import type { Manifest } from '#types/manifest.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { readBaselines } from '#cli/run/baselines.ts';
import type { TrackedFile } from '#types/repository.ts';
import type { ScopeSelection, Session } from '#types/run.ts';
// File explanations: claims, checks, baselines, and ignores within the selected scope.
import type { Explanation, PathExplanation } from '#types/output.ts';
import { claimants, claimedByClaims, pathMatcher } from '#cli/presets/claims.ts';

function uncheckedNote(file: TrackedFile): string | undefined {
    if (file.nature === 'binary') return 'binary: the secrets scan runs over it and nothing else';
    if (file.nature === 'generated') {
        const by = file.producedBy === undefined ? '' : ` by ${file.producedBy}`;
        return `generated${by}: secrets and freshness checks only`;
    }
    if (file.nature === 'vendored') return 'vendored: secrets, licenses and security checks only';
    return undefined;
}

function checksFor(
    owners: Manifest[],
    selection: ScopeSelection,
    file: TrackedFile,
    scopePath: string,
): PathExplanation['checks'] {
    return owners.flatMap((manifest) =>
        manifest.checks
            .filter(
                (check) =>
                    !check.claims || claimedByClaims(check.claims, selection.selected, [file], scopePath).length > 0,
            )
            .map((check) => ({ id: check.id, stage: check.stage, preset: manifest.preset.name })),
    );
}

function baselinesFor(root: string, path: string): PathExplanation['baselines'] {
    return readBaselines(root).flatMap((baseline) => {
        const count = baseline.paths[path];
        return count === undefined ? [] : [{ check: baseline.check, rule: baseline.rule, count }];
    });
}

function ignoresFor(session: Session, path: string): PathExplanation['ignores'] {
    return session.policyFiles.policy.ignores
        .filter((entry) => entry.paths !== undefined && pathMatcher(entry.paths)(path))
        .map((entry) => ({
            check: entry.check,
            ...(entry.rule === undefined ? {} : { rule: entry.rule }),
            reason: entry.reason,
        }));
}

function ignoreLine(entry: PathExplanation['ignores'][number]): string {
    const rule = entry.rule === undefined ? '' : ` ${entry.rule}`;
    return `  ${entry.check}${rule}  ${entry.reason}`;
}

function annotated(report: PathExplanation, file: TrackedFile, ownerCount: number): PathExplanation {
    const unchecked = uncheckedNote(file);
    if (unchecked !== undefined) report.unchecked = unchecked;
    if (ownerCount === 0 && file.nature === 'source') {
        report.unchecked = 'no selected preset claims this file';
        report.remedy = 'gspot declare "<glob>" --produced-by "..." or --vendored, or gspot add <preset>';
    }
    return report;
}

function section(title: string, rows: string[]): string[] {
    return rows.length === 0 ? [] : [title, ...rows];
}

/**
 * Explains one file.
 * @param session the session
 * @param path the file, relative to the root
 * @returns the report, or an error when git does not track the path
 */
function pathReport(session: Session, path: string): PathExplanation | { error: string } {
    const file = session.repository.files.find((entry) => entry.path === path);
    if (!file) return { error: `${path} is not a file git tracks or would track here.` };
    const scope = scopeOf(path, session.repository.scopes);
    const selection = session.scopes.find((entry) => entry.scope.path === scope.path) ?? session.scopes[0];
    const owners = selection ? claimants(file, selection.selected) : [];
    const report: PathExplanation = {
        path,
        scope: scope.path === '' ? 'root' : scope.path,
        nature: file.nature,
        tags: file.tags,
        presets: owners.map((manifest) => manifest.preset.name),
        checks: selection ? checksFor(owners, selection, file, scope.path) : [],
        baselines: baselinesFor(session.root, path),
        ignores: ignoresFor(session, path),
    };
    if (file.natureSource !== undefined) report.natureSource = file.natureSource;
    return annotated(report, file, owners.length);
}

/**
 * The report as text.
 * @param report the report
 * @returns the text for stdout
 */
function pathText(report: PathExplanation): string {
    const by = report.natureSource === undefined ? '' : ` by ${report.natureSource}`;
    const lines = [
        `${report.path}  (scope ${report.scope}, ${report.nature}${by})`,
        '',
        ...(report.unchecked === undefined ? [] : [report.unchecked]),
        ...(report.presets.length === 0 ? [] : [`claimed by: ${report.presets.join(', ')}`]),
        ...section(
            'checks:',
            report.checks.map((check) => `  ${check.id}  ${check.stage}  (${check.preset})`),
        ),
        ...section(
            'baselines:',
            report.baselines.map(
                (entry) => `  ${entry.check}:${entry.rule}  ${String(entry.count)} recorded in this file`,
            ),
        ),
        ...section(
            'ignores:',
            report.ignores.map((entry) => ignoreLine(entry)),
        ),
        ...(report.remedy === undefined ? [] : ['', `to change this: ${report.remedy}`]),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Explains a repository file or an explicitly requested path.
 * @param session the repository session, or undefined outside a configured repository
 * @param subject the file path or another explanation subject
 * @returns the file explanation, a missing-path error, or undefined for another subject
 */
export function explainPath(
    session: Session | undefined,
    subject: string,
): Explanation | { error: string } | undefined {
    if (session === undefined) return undefined;
    const path = subject.startsWith('./') ? subject.slice('./'.length) : subject;
    const isTracked = session.repository.files.some((file) => file.path === path);
    if (!isTracked && !subject.startsWith('./')) return undefined;
    const report = pathReport(session, path);
    if ('error' in report) return report;
    return { kind: 'path', subject: path, text: pathText(report), data: report };
}
