import { GspotError } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { type Explanation, type PathExplanation } from '#cli/types/commands/explain.ts';

function formatUncheckedKind(file: TrackedFile): string | undefined {
    if (file.kind === 'binary') return 'binary: eligible for secrets and size checks';
    if (file.kind === 'generated') return 'generated: eligible for secret checks and checks for stale generated files';
    if (file.kind === 'vendored') return 'vendored: eligible for secrets, license, and security checks';
    return undefined;
}

/**
 * Find the scope, kind, configurations, checks, and ignores of one tracked file, and say why no check reads it.
 *
 * @param session the configurations, files, and ignores of this run.
 * @param file the tracked path to explain.
 * @returns the report for the file.
 */
function buildPathExplanation(session: Session, file: TrackedFile): PathExplanation {
    const { path } = file;
    const folder = findScopeFolder(path, session.repository.scopeFolders);
    const scope = session.scopes.find((entry) => entry.folder.path === folder.path) as Scope;
    const configurations = scope.configurations.filter(
        (configuration) =>
            listCoveredFiles(configuration.files, [file], {
                configurations: scope.configurations,
                scopePath: scope.folder.path,
                settings: scope.settings,
            }).length > 0,
    );
    const report: PathExplanation = {
        path,
        scope: folder.path === '' ? ROOT_SCOPE_LABEL : folder.path,
        fileKind: file.kind,
        tags: file.tags,
        configurations: configurations.map((configuration) => configuration.name),
        checks: session.configuredChecks
            .filter((check) => listCheckedFiles(session.scopes, check).some((entry) => entry.path === file.path))
            .map((check) => ({
                check: check.check.id,
                stage: check.check.stage,
                ...(check.configuration === undefined ? {} : { configuration: check.configuration.name }),
            })),
        ignores: session.settingsFile.settings.ignore
            .filter(
                (entry) => entry.paths === undefined || entry.paths.length === 0 || buildPathMatcher(entry.paths)(path),
            )
            .map((entry) => ({
                ...(entry.check === undefined ? {} : { check: entry.check }),
                ...(entry.rule === undefined ? {} : { rule: entry.rule }),
                reason: entry.reason,
            })),
        fileKindOrigin: file.kindOrigin,
    };
    const unchecked = formatUncheckedKind(file);
    if (unchecked !== undefined) report.unchecked = unchecked;
    if (report.checks.length === 0 && file.kind === 'source') {
        report.unchecked = 'no selected check reads this file';
        report.remedy =
            'Mark generated or copied files linguist-generated or linguist-vendored in .gitattributes, or run gspot add <configuration>.';
    }
    return report;
}

function formatPathExplanation(report: PathExplanation): string {
    const by = report.fileKindOrigin === undefined ? '' : ` by ${report.fileKindOrigin}`;
    const checks = report.checks.map(
        (check) => `  ${check.check}  ${check.stage}  (${check.configuration ?? 'repository command'})`,
    );
    const ignores = report.ignores.map((entry) => {
        const rule = entry.rule === undefined ? '' : ` ${entry.rule}`;
        const reason = entry.reason === undefined ? '' : `  ${entry.reason}`;
        return `  ${entry.check ?? 'every check'}${rule}${reason}`;
    });
    const lines = [
        `${report.path}  (scope ${report.scope}, ${report.fileKind}${by})`,
        '',
        ...(report.unchecked === undefined ? [] : [report.unchecked]),
        ...(report.configurations.length === 0 ? [] : [`Checked by: ${report.configurations.join(', ')}`]),
        ...(checks.length === 0 ? [] : ['Checks:', ...checks]),
        ...(ignores.length === 0 ? [] : ['Ignores:', ...ignores]),
        ...(report.remedy === undefined ? [] : ['', `To change this: ${report.remedy}`]),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Explain a repository file or a path that the subject names.
 *
 * @param session the repository, or undefined outside a configured one.
 * @param subject the file path, or what else the user typed.
 * @returns the file explanation, or undefined for another subject.
 * @throws GspotError when a named path does not exist.
 */
export function explainPath(session: Session | undefined, subject: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const path = subject.startsWith('./') ? subject.slice('./'.length) : subject;
    const file = session.repository.files.find((entry) => entry.path === path);
    if (file === undefined) {
        if (subject.startsWith('./')) throw new GspotError('arguments', `${path} is not a file in this repository.`);
        return undefined;
    }
    const report = buildPathExplanation(session, file);
    return { kind: 'path', subject: path, text: formatPathExplanation(report), data: report };
}
