import { scopeOf } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/platform/errors.ts';
import type { Session } from '#cli/types/planning.ts';
import { ownersOf } from '#cli/configurations/owners.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { ownedInputs, configuredChecks } from '#cli/planning/plan.ts';
import type { Explanation, PathExplanation } from '#cli/types/commands/explain.ts';

function uncheckedNote(file: TrackedFile): string | undefined {
    if (file.kind === 'binary') return 'binary: eligible for secrets and size checks';
    if (file.kind === 'generated') {
        const by = file.producedBy === undefined ? '' : ` by ${file.producedBy}`;
        return `generated${by}: eligible for secrets and freshness checks`;
    }
    if (file.kind === 'vendored') return 'vendored: eligible for secrets, license, and security checks';
    return undefined;
}

/**
 * Explains one file.
 * @param session the session.
 * @param file the inventoried file.
 * @returns file ownership, enabled checks, and recorded ignores.
 */
function buildPathReport(session: Session, file: TrackedFile): PathExplanation {
    const { path } = file;
    const scope = scopeOf(path, session.repository.scopes);
    const selection = session.scopes.find((entry) => entry.scope.path === scope.path) ?? session.scopes[0];
    const owners = selection ? ownersOf(file, selection.selected) : [];
    const report: PathExplanation = {
        path,
        scope: scope.path === '' ? 'root' : scope.path,
        fileKind: file.kind,
        tags: file.tags,
        configurations: owners.map((manifest) => manifest.configuration.name),
        checks: configuredChecks(session)
            .filter((check) => ownedInputs(session, check).some((entry) => entry.path === file.path))
            .map((check) => ({
                check: check.check.name,
                stage: check.check.stage,
                ...(check.manifest === undefined ? {} : { configuration: check.manifest.configuration.name }),
            })),
        ignores: session.policyFiles.policy.ignores
            .filter((entry) => entry.paths === undefined || entry.paths.length === 0 || pathMatcher(entry.paths)(path))
            .map((entry) => ({
                check: entry.check,
                ...(entry.rule === undefined ? {} : { rule: entry.rule }),
                ...(entry.reason === undefined ? {} : { reason: entry.reason }),
            })),
    };
    if (file.kindSource !== undefined) report.fileKindSource = file.kindSource;
    const unchecked = uncheckedNote(file);
    if (unchecked !== undefined) report.unchecked = unchecked;
    if (report.checks.length === 0 && file.kind === 'source') {
        report.unchecked = 'no enabled check owns this file';
        report.remedy = 'gspot set generated "<glob>" or gspot set vendored "<glob>", or gspot add <configuration>';
    }
    return report;
}

/**
 * The report as text.
 * @param report the report.
 * @returns the text for stdout.
 */
function formatPathReport(report: PathExplanation): string {
    const by = report.fileKindSource === undefined ? '' : ` by ${report.fileKindSource}`;
    const checks = report.checks.map(
        (check) => `  ${check.check}  ${check.stage}  (${check.configuration ?? 'repository command'})`,
    );
    const ignores = report.ignores.map((entry) => {
        const rule = entry.rule === undefined ? '' : ` ${entry.rule}`;
        const reason = entry.reason === undefined ? '' : `  ${entry.reason}`;
        return `  ${entry.check}${rule}${reason}`;
    });
    const lines = [
        `${report.path}  (scope ${report.scope}, ${report.fileKind}${by})`,
        '',
        ...(report.unchecked === undefined ? [] : [report.unchecked]),
        ...(report.configurations.length === 0 ? [] : [`owned by: ${report.configurations.join(', ')}`]),
        ...(checks.length === 0 ? [] : ['checks:', ...checks]),
        ...(ignores.length === 0 ? [] : ['ignores:', ...ignores]),
        ...(report.remedy === undefined ? [] : ['', `to change this: ${report.remedy}`]),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Explains a repository file or an explicitly requested path.
 * @param session the repository session, or undefined outside a configured repository.
 * @param subject the file path or another explanation subject.
 * @returns the file explanation, or undefined for another subject.
 * @throws GspotError when an explicitly requested path is absent.
 */
export function explainPath(session: Session | undefined, subject: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const path = subject.startsWith('./') ? subject.slice('./'.length) : subject;
    const file = session.repository.files.find((entry) => entry.path === path);
    if (file === undefined) {
        if (subject.startsWith('./'))
            throw new GspotError('selection', `${path} is not a file git tracks or would track here.`);
        return undefined;
    }
    const report = buildPathReport(session, file);
    return { kind: 'path', subject: path, text: formatPathReport(report), data: report };
}
