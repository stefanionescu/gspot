import { GspotError } from '#cli/system/errors.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { type Session } from '#cli/types/planning.ts';
import { formatScopeLabel } from '#cli/system/terminal.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { listCoveredInputs, listConfiguredChecks } from '#cli/planning/checks.ts';
import { type Explanation, type PathExplanation } from '#cli/types/commands/explain.ts';

function formatUncheckedKind(file: TrackedFile): string | undefined {
    if (file.kind === 'binary') return 'binary: eligible for secrets and size checks';
    if (file.kind === 'generated') return 'generated: eligible for secret checks and checks for stale generated files';
    if (file.kind === 'vendored') return 'vendored: eligible for secrets, license, and security checks';
    return undefined;
}

/**
 * Explain one file.
 * @param session the configurations, files, and ignores of this run.
 * @param file the tracked path to explain.
 * @returns the configurations, checks, and ignores for the file.
 */
function buildPathReport(session: Session, file: TrackedFile): PathExplanation {
    const { path } = file;
    const scope = findScope(path, session.repository.scopes);
    const selection = session.scopes.find((entry) => entry.scope.path === scope.path) as ScopeSelection;
    const configurations = selection.selected.filter(
        (manifest) =>
            listCoveredFiles(manifest.files, [file], {
                selected: selection.selected,
                scope: selection.scope.path,
                view: selection.view,
            }).length > 0,
    );
    const report: PathExplanation = {
        path,
        scope: formatScopeLabel(scope.path),
        fileKind: file.kind,
        tags: file.tags,
        configurations: configurations.map((manifest) => manifest.configuration.name),
        checks: listConfiguredChecks(session)
            .filter((check) => listCoveredInputs(session, check).some((entry) => entry.path === file.path))
            .map((check) => ({
                check: check.check.name,
                stage: check.check.stage,
                ...(check.manifest === undefined ? {} : { configuration: check.manifest.configuration.name }),
            })),
        ignores: session.settingsFile.settings.ignore
            .filter(
                (entry) => entry.paths === undefined || entry.paths.length === 0 || buildPathMatcher(entry.paths)(path),
            )
            .map((entry) => ({
                check: entry.check,
                ...(entry.rule === undefined ? {} : { rule: entry.rule }),
                reason: entry.reason,
            })),
    };
    if (file.kindOrigin !== undefined) report.fileKindOrigin = file.kindOrigin;
    const unchecked = formatUncheckedKind(file);
    if (unchecked !== undefined) report.unchecked = unchecked;
    if (report.checks.length === 0 && file.kind === 'source') {
        report.unchecked = 'no selected check reads this file';
        report.remedy =
            'Mark generated or copied files linguist-generated or linguist-vendored in .gitattributes, or run gspot add <configuration>.';
    }
    return report;
}

/**
 * Format the file report as text.
 * @param report the kind, checks, and ignores of the file.
 * @returns the text for stdout.
 */
function formatPathReport(report: PathExplanation): string {
    const by = report.fileKindOrigin === undefined ? '' : ` by ${report.fileKindOrigin}`;
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
        ...(report.configurations.length === 0 ? [] : [`checked by: ${report.configurations.join(', ')}`]),
        ...(checks.length === 0 ? [] : ['checks:', ...checks]),
        ...(ignores.length === 0 ? [] : ['ignores:', ...ignores]),
        ...(report.remedy === undefined ? [] : ['', `to change this: ${report.remedy}`]),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Explain a repository file or a path that the subject names.
 * @param session the repository, or undefined outside a configured one.
 * @param subject the file path, or what else the user typed.
 * @returns the file explanation, or undefined for another subject.
 * @throws GspotError when a named path does not exist.
 */
function explainPath(session: Session | undefined, subject: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const path = subject.startsWith('./') ? subject.slice('./'.length) : subject;
    const file = session.repository.files.find((entry) => entry.path === path);
    if (file === undefined) {
        if (subject.startsWith('./')) throw new GspotError('arguments', `${path} is not a file in this repository.`);
        return undefined;
    }
    const report = buildPathReport(session, file);
    return { kind: 'path', subject: path, text: formatPathReport(report), data: report };
}
export { explainPath };
