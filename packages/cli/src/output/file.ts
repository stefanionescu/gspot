import type { Session } from '#cli/run/session.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Explanation } from '#cli/output/explain.ts';
import { claimedInputs, configuredChecks } from '#cli/run/plan.ts';
// File explanations: claims, checks, and ignores within the selected scope.
import { claimants, pathMatcher } from '#cli/configurations/claims.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';

function uncheckedNote(file: TrackedFile): string | undefined {
    if (file.nature === 'binary') return 'binary: eligible for secrets and size checks';
    if (file.nature === 'generated') {
        const by = file.producedBy === undefined ? '' : ` by ${file.producedBy}`;
        return `generated${by}: eligible for secrets and freshness checks`;
    }
    if (file.nature === 'vendored') return 'vendored: eligible for secrets, license, and security checks';
    return undefined;
}

function checksFor(session: Session, file: TrackedFile): PathExplanation['checks'] {
    return configuredChecks(session)
        .filter((check) => claimedInputs(session, check).some((entry) => entry.path === file.path))
        .map((check) => ({
            check: check.check,
            stage: check.spec.stage,
            ...(check.manifest === undefined ? {} : { configuration: check.manifest.configuration.name }),
        }));
}

function ignoresFor(session: Session, path: string): PathExplanation['ignores'] {
    return session.policyFiles.policy.ignores
        .filter((entry) => entry.paths === undefined || entry.paths.length === 0 || pathMatcher(entry.paths)(path))
        .map((entry) => ({
            check: entry.check,
            ...(entry.rule === undefined ? {} : { rule: entry.rule }),
            ...(entry.reason === undefined ? {} : { reason: entry.reason }),
        }));
}

function ignoreLine(entry: PathExplanation['ignores'][number]): string {
    const rule = entry.rule === undefined ? '' : ` ${entry.rule}`;
    return `  ${entry.check}${rule}${entry.reason === undefined ? '' : `  ${entry.reason}`}`;
}

function annotated(report: PathExplanation, file: TrackedFile): PathExplanation {
    const unchecked = uncheckedNote(file);
    if (unchecked !== undefined) report.unchecked = unchecked;
    if (report.checks.length === 0 && file.nature === 'source') {
        report.unchecked = 'no enabled check claims this file';
        report.remedy = 'gspot set generated "<glob>" or gspot set vendored "<glob>", or gspot add <configuration>';
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
        configurations: owners.map((manifest) => manifest.configuration.name),
        checks: checksFor(session, file),
        ignores: ignoresFor(session, path),
    };
    if (file.natureSource !== undefined) report.natureSource = file.natureSource;
    return annotated(report, file);
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
        ...(report.configurations.length === 0 ? [] : [`claimed by: ${report.configurations.join(', ')}`]),
        ...section(
            'checks:',
            report.checks.map(
                (check) => `  ${check.check}  ${check.stage}  (${check.configuration ?? 'repository command'})`,
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

type PathExplanation = {
    path: string;
    scope: string;
    nature: string;
    natureSource?: string;
    tags: string[];
    configurations: string[];
    checks: { check: string; stage: string; configuration?: string }[];
    ignores: { check: string; rule?: string; reason?: string }[];
    unchecked?: string;
    remedy?: string;
};
