import { GspotError } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { findScopePath, buildArgumentPath } from '#cli/repository/scopes.ts';
import { type Explanation, type PathExplanation } from '#cli/types/commands/explain.ts';

function formatUncheckedKind(file: TrackedFile): string | undefined {
    if (file.kind === 'binary') return 'binary: eligible for secrets and size checks';
    if (file.kind === 'generated') return 'generated: eligible for secret checks and checks for stale generated files';
    return file.kind === 'vendored' ? 'vendored: eligible for secrets, license, and security checks' : undefined;
}

function buildPathExplanation(session: Session, file: TrackedFile): PathExplanation {
    const { path } = file;
    const scopePath = findScopePath(path, session.scopes);
    const scope = session.scopes.find((each) => each.path === scopePath) as Scope;
    const checks = session.configuredChecks.filter((check) =>
        listCheckedFiles(session.scopes, check).some((checkedFile) => checkedFile.path === file.path),
    );
    const covering = new Set(
        checks.flatMap(({ configuration }) => (configuration === undefined ? [] : [configuration.name])),
    );
    const report: PathExplanation = {
        path,
        scope: scopePath === '' ? ROOT_SCOPE_LABEL : scopePath,
        fileKind: file.kind,
        tags: file.tags,
        configurations: scope.configurations.map(({ name }) => name).filter((name) => covering.has(name)),
        checks: checks.map((check) => ({
            check: check.check.id,
            stage: check.check.stage,
            ...(check.configuration !== undefined && { configuration: check.configuration.name }),
        })),
        ignores: session.settingsFile.settings.ignore
            .filter(
                (ignore) =>
                    ignore.paths === undefined || ignore.paths.length === 0 || buildPathMatcher(ignore.paths)(path),
            )
            .map((ignore) => ({
                ...(ignore.check !== undefined && { check: ignore.check }),
                ...(ignore.rule !== undefined && { rule: ignore.rule }),
                reason: ignore.reason,
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
    const ignores = report.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const reason = `  ${ignore.reason}`;
        return `  ${ignore.check ?? 'every check'}${rule}${reason}`;
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
Explain a repository file or a path that the subject names.

@param session the repository, or undefined outside a configured one.
@param subject the file path, or what else the user typed.
@param cwd the folder where the command starts.
@returns the file explanation, or undefined for another subject.
@throws GspotError when a named path does not exist.
*/
export function explainPath(session: Session | undefined, subject: string, cwd: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const path = buildArgumentPath(session.root, cwd, subject);
    const file = session.repository.files.find((each) => each.path === path);
    if (file === undefined) {
        if (subject.startsWith('./') || subject.startsWith('../'))
            throw new GspotError('arguments', `${path} is not a file in this repository.`);
        return undefined;
    }
    const report = buildPathExplanation(session, file);
    return { kind: 'path', subject: path, text: formatPathExplanation(report), facts: report };
}
