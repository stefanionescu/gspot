import {
    BINARY_ELIGIBLE_MESSAGE,
    GENERATED_ELIGIBLE_MESSAGE,
    IGNORED_FILE_MESSAGE,
    MARK_GENERATED_MESSAGE,
    UNCHECKED_REASON,
    VENDORED_ELIGIBLE_MESSAGE,
} from '#cli/config/commands/reports.ts';
import { EVERY_CHECK } from '#cli/config/engine.ts';
import { listCheckedFiles } from '#cli/engine/files.ts';
import { buildCheckState, planChecks } from '#cli/engine/plan.ts';
import { buildArgumentPath, selectScope } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { formatScope } from '#cli/system/text.ts';
import type { Explanation, PathExplanation } from '#cli/types/commands/reports.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { Session } from '#cli/types/tools.ts';

function formatUncheckedKind(file: TrackedFile): string | null {
    if (file.kind === 'binary') return BINARY_ELIGIBLE_MESSAGE;
    if (file.kind === 'generated') return GENERATED_ELIGIBLE_MESSAGE;
    return file.kind === 'vendored' ? VENDORED_ELIGIBLE_MESSAGE : null;
}

function buildPathExplanation(session: Session, file: TrackedFile): PathExplanation {
    const { path } = file;
    const scope = selectScope(path, session.scopes);
    const checks = planChecks(session, { stage: 'any', keepLevelOff: true }).filter((check) =>
        listCheckedFiles(session.scopes, check).some((checkedFile) => checkedFile.path === file.path),
    );
    const running = checks.filter(({ skip }) => skip?.cause !== 'level');
    const covering = new Set(
        running.flatMap(({ configuration }) => (configuration === undefined ? [] : [configuration.name])),
    );
    const report: PathExplanation = {
        path,
        scope: scope.path,
        fileKind: file.kind,
        tags: file.tags,
        configurations: scope.configurations.map(({ name }) => name).filter((name) => covering.has(name)),
        checks: checks.map((check) => {
            const state = buildCheckState(check);
            return {
                check: check.check.id,
                stage: check.check.stage,
                state: state.status === 'on' ? 'on' : `skipped (${state.cause})`,
                ...(check.configuration !== undefined && { configuration: check.configuration.name }),
            };
        }),
        ignores: session.settings.ignore
            .filter((ignore) => ignore.paths === undefined || buildPathMatcher(ignore.paths)(path))
            .map((ignore) => ({
                ...(ignore.check !== undefined && { check: ignore.check }),
                ...(ignore.rule !== undefined && { rule: ignore.rule }),
                reason: ignore.reason,
            })),
        fileKindOrigin: file.kindOrigin,
        unchecked: formatUncheckedKind(file),
        remedy: null,
    };
    if (running.length === 0 && file.kind === 'source') {
        report.unchecked = UNCHECKED_REASON;
        report.remedy = report.ignores.length > 0 ? IGNORED_FILE_MESSAGE : MARK_GENERATED_MESSAGE;
    }
    return report;
}

function formatPathExplanation(explanation: PathExplanation): string {
    const checks = explanation.checks.map((check) => `  ${check.check}  ${check.stage}  ${check.state}`);
    const ignores = explanation.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const reason = `  ${ignore.reason}`;
        return `  ${ignore.check ?? EVERY_CHECK}${rule}${reason}`;
    });
    const lines = [
        `${explanation.path}  (scope ${formatScope(explanation.scope)}, kind ${explanation.fileKind} by ${explanation.fileKindOrigin})`,
        '',
        ...(explanation.unchecked === null ? [] : [explanation.unchecked]),
        ...(explanation.configurations.length === 0 ? [] : [`Checked by: ${explanation.configurations.join(', ')}`]),
        ...(checks.length === 0 ? [] : ['Checks:', ...checks]),
        ...(ignores.length === 0 ? [] : ['Ignores:', ...ignores]),
        ...(explanation.remedy === null ? [] : ['', `To change this: ${explanation.remedy}`]),
    ];
    return `${lines.join('\n')}\n`;
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
