import { getPosition } from '#cli/system/text.ts';
import { findToolName } from '#cli/tools/pins.ts';
import type { Session } from '#cli/types/tools.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { SourceComment } from '#cli/types/parsers.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { isReasonAccepted } from '#cli/settings/validation/reasons.ts';
import { MESSAGE_REFERENCES } from '#cli/config/configurations/general.ts';
import { parseComments, stripCommentEnd } from '#cli/parsers/code/comments.ts';
import type { FindingPlace, SuppressionSyntax } from '#cli/types/configurations/general.ts';
import { REASON_ABOVE, SETTINGS_REASON, SUPPRESSION_KIND_MESSAGES } from '#cli/config/configurations/structure.ts';

function findReasonAbove(previous: SourceComment | undefined, comment: SourceComment): string | undefined {
    if (
        previous === undefined ||
        !previous.standalone ||
        previous.line + 1 !== comment.line ||
        previous.text.includes('\n')
    )
        return undefined;
    const text = stripCommentEnd(previous.text);
    return REASON_ABOVE.exec(text)?.groups?.['reason']?.trim();
}

function listSuppressionSyntaxes(scope: Scope, scopeFiles: TrackedFile[]): SuppressionSyntax[] {
    const checks = scope.configurations.flatMap((configuration) =>
        configuration.checks.map((check) => ({ check, files: check.files ?? configuration.files })),
    );
    const definitions = new Map(
        scope.configurations.flatMap((configuration) =>
            configuration.tools.flatMap((tool) =>
                tool.suppression === undefined ? [] : [[tool.name, tool.suppression] as const],
            ),
        ),
    );
    return [...definitions].map(([tool, definition]) => {
        const readers = checks.filter(({ check }) => findToolName(check) === tool);
        const reason = new RegExp(definition.reason, 'u');
        return {
            tool,
            covered: new Set(
                readers.flatMap(({ files }) =>
                    listCoveredFiles(files, scopeFiles, {
                        configurations: scope.configurations,
                        scopePath: scope.path,
                        settings: scope.settings,
                    }).map((file) => file.path),
                ),
            ),
            marker: new RegExp(definition.marker, 'u'),
            inlineMarker: new RegExp(definition.inline_marker ?? definition.marker, 'u'),
            extractReason: (text: string) => reason.exec(text)?.groups?.['reason']?.trim(),
            forbidden: definition.forbidden === true,
            separator: definition.separator === undefined ? undefined : new RegExp(definition.separator, 'u'),
            allRules: definition.all_rules === undefined ? undefined : new RegExp(definition.all_rules, 'u'),
            limitRules: definition.limit_rules === undefined ? undefined : new RegExp(definition.limit_rules, 'u'),
        };
    });
}

function parseSuppressionRules(syntax: SuppressionSyntax, text: string): string | undefined {
    if (syntax.separator === undefined) return undefined;
    const suppression = syntax.marker.exec(text);
    return suppression === null ? undefined : (suppression.groups?.['rules'] ?? '').split(syntax.separator)[0];
}

function classifySuppression(
    syntax: SuppressionSyntax,
    text: string,
    preceding: string | undefined,
): keyof typeof SUPPRESSION_KIND_MESSAGES | 'no-reason' | undefined {
    const rules = parseSuppressionRules(syntax, text);
    if (rules !== undefined) {
        if (syntax.allRules?.test(rules.trim()) === true) return 'all';
        if (syntax.limitRules?.test(rules) === true) return 'limit';
    }
    return isReasonAccepted(syntax.extractReason(text) ?? preceding) ? undefined : 'no-reason';
}

function listReasonReferences(reason: string | undefined, place: FindingPlace): CheckFinding[] {
    return MESSAGE_REFERENCES.filter(({ pattern }) => pattern.test(reason ?? '')).map(({ rule, message }) => ({
        ...place,
        rule,
        message: `This reason ${message}`,
    }));
}

function validateSuppressionComment(
    syntax: SuppressionSyntax,
    comment: SourceComment & FindingPlace,
    preceding: string | undefined,
): CheckFinding[] {
    const text = stripCommentEnd(comment.text);
    const marker = comment.standalone ? syntax.marker : syntax.inlineMarker;
    if (!marker.test(text)) return [];
    const at = { file: comment.file, line: comment.line };
    if (syntax.forbidden)
        return [
            {
                ...at,
                rule: syntax.tool,
                message: `${syntax.tool} suppression is not allowed; fix the finding or configure an explicit ignore.`,
            },
        ];
    const kind = classifySuppression(syntax, text, preceding);
    if (kind === undefined) return listReasonReferences(syntax.extractReason(text) ?? preceding, at);
    const message =
        kind === 'no-reason'
            ? `This ${syntax.tool} suppression has no reason of two or more words.`
            : SUPPRESSION_KIND_MESSAGES[kind];
    return [{ ...at, rule: `${syntax.tool}-${kind}`, message: message }];
}

/**
Reports forbidden suppressions, suppressions that turn off every rule or a size limit, and suppressions without a
reason.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkSuppressions(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const filesByScope = Map.groupBy(
        planned.files.filter((file) => file.tags.includes('text')),
        (file) => selectScopePath(file.path, session.scopes),
    );
    const found: CheckFinding[] = [];
    for (const scope of session.scopes) {
        const files = filesByScope.get(scope.path) ?? [];
        const syntaxes = listSuppressionSyntaxes(scope, files);
        for (const file of files) {
            const forms = syntaxes.filter((form) => form.covered.has(file.path));
            const source = readText(session.cache, file.path);
            const comments = await parseComments(file.path, source, file.tags, session);
            found.push(
                ...comments.flatMap((comment, index) => {
                    const preceding = findReasonAbove(comments[index - 1], comment);
                    return forms.flatMap((form) =>
                        validateSuppressionComment(form, { ...comment, file: file.path }, preceding),
                    );
                }),
            );
        }
    }
    const settings = findText(session.cache, SETTINGS_FILE) ?? '';
    const settingsReasons = settings
        .matchAll(SETTINGS_REASON)
        .flatMap((match) =>
            listReasonReferences(match.groups?.['reason'], {
                file: SETTINGS_FILE,
                line: getPosition(settings, match.index).line,
            }),
        )
        .toArray();
    return [...found, ...settingsReasons];
}
