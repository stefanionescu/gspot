import { GspotError } from '#cli/system/errors.ts';
import { EVERY_CHECK } from '#cli/config/ignores.ts';
import { planChecks } from '#cli/planning/checks.ts';
import type { Session } from '#cli/types/session.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { stripControlCharacters } from '#cli/system/terminal.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { selectScopePath, buildArgumentPath } from '#cli/repository/scopes.ts';
import type { Explanation, PathExplanation } from '#cli/types/commands/explain.ts';

import {
    UNCHECKED_REASON,
    REPOSITORY_COMMAND,
    MARK_GENERATED_MESSAGE,
    BINARY_ELIGIBLE_MESSAGE,
    VENDORED_ELIGIBLE_MESSAGE,
    GENERATED_ELIGIBLE_MESSAGE,
} from '#cli/config/commands/explain.ts';

function formatUncheckedKind(file: TrackedFile): string | undefined {
    if (file.kind === 'binary') return BINARY_ELIGIBLE_MESSAGE;
    if (file.kind === 'generated') return GENERATED_ELIGIBLE_MESSAGE;
    return file.kind === 'vendored' ? VENDORED_ELIGIBLE_MESSAGE : undefined;
}

function buildPathExplanation(session: Session, file: TrackedFile): PathExplanation {
    const { path } = file;
    const scopePath = selectScopePath(path, session.scopes);
    const scope = session.scopes.find((each) => each.path === scopePath) as Scope;
    const checks = planChecks(session, { stage: 'any' }).filter((check) =>
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
        ignores: session.settings.ignore
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
        report.unchecked = UNCHECKED_REASON;
        report.remedy = MARK_GENERATED_MESSAGE;
    }
    return report;
}

function formatPathExplanation(explanation: PathExplanation): string {
    const by = explanation.fileKindOrigin === undefined ? '' : ` by ${explanation.fileKindOrigin}`;
    const checks = explanation.checks.map(
        (check) => `  ${check.check}  ${check.stage}  (${check.configuration ?? REPOSITORY_COMMAND})`,
    );
    const ignores = explanation.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const reason = `  ${ignore.reason}`;
        return `  ${ignore.check ?? EVERY_CHECK}${rule}${reason}`;
    });
    const lines = [
        `${explanation.path}  (scope ${explanation.scope}, ${explanation.fileKind}${by})`,
        '',
        ...(explanation.unchecked === undefined ? [] : [explanation.unchecked]),
        ...(explanation.configurations.length === 0 ? [] : [`Checked by: ${explanation.configurations.join(', ')}`]),
        ...(checks.length === 0 ? [] : ['Checks:', ...checks]),
        ...(ignores.length === 0 ? [] : ['Ignores:', ...ignores]),
        ...(explanation.remedy === undefined ? [] : ['', `To change this: ${explanation.remedy}`]),
    ];
    return `${lines.map((line) => stripControlCharacters(line)).join('\n')}\n`;
}

/**
Explain a repository file or a path that the subject names.

@param session the repository, or undefined outside a configured one.
@param subject the file path, or what else the user typed.
@param cwd the folder where the command starts.
@returns undefined for another subject.
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
