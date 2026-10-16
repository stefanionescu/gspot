import { findingAt } from '#cli/checks/finding.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { getToolName } from '#cli/configurations/tools.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { REASON_ABOVE } from '#cli/config/checks/general/gspot.ts';
import { type SourceComment } from '#cli/types/parsers/comments.ts';
import { type ScopeSelection } from '#cli/types/settings/values.ts';
import { type SuppressionSyntax } from '#cli/types/checks/general.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { isReasonAccepted } from '#cli/settings/validation/reasons.ts';
import { parseComments, stripCommentEnd } from '#cli/parsers/comments.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';

// A preceding reason belongs only to the next line. Intervening source or comments break adjacency.
function reasonAbove(previous: SourceComment | undefined, comment: SourceComment): string | undefined {
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

// Only tools whose checks claim this source contribute suppression syntax.
function suppressionSyntaxes(selection: ScopeSelection): SuppressionSyntax[] {
    const selected = selection.selected;
    const checks = selected.flatMap((manifest) =>
        manifest.checks.map((check) => ({ check, files: check.files ?? manifest.files })),
    );
    const definitions = new Map(
        selected.flatMap((manifest) =>
            manifest.tools.flatMap((tool) =>
                tool.suppression === undefined ? [] : [[tool.name, tool.suppression] as const],
            ),
        ),
    );
    return [...definitions].map(([tool, definition]) => {
        const readers = checks.filter(({ check }) => getToolName(check) === tool);
        return {
            tool,
            covers: (file: TrackedFile) =>
                readers.some(
                    ({ files }) =>
                        listCoveredFiles(files, [file], { selected, scope: selection.scope.path, view: selection.view })
                            .length > 0,
                ),
            marker: new RegExp(definition.marker, 'u'),
            inlineMarker: new RegExp(definition.inline_marker ?? definition.marker, 'u'),
            reason: new RegExp(definition.reason, 'u'),
            forbidden: definition.forbidden === true,
        };
    });
}

function hasAcceptedReason(form: SuppressionSyntax, text: string, preceding: string | undefined): boolean {
    const reason = form.reason.exec(text)?.groups?.['reason']?.trim() ?? preceding;
    return isReasonAccepted(reason);
}

/**
 * Report forbidden suppressions and missing or invalid required reasons.
 * @param input the check input with the read suppression comments.
 * @returns the findings.
 */
async function suppressions(input: CheckInput): Promise<Finding[]> {
    const scopes = input.selections.map((selection) => selection.scope);
    const selections = new Map(input.selections.map((selection) => [selection.scope.path, selection]));
    const found: Finding[] = [];
    for (const [scope, selection] of selections) {
        const syntaxes = suppressionSyntaxes(selection);
        for (const file of input.files.filter(
            (file) =>
                file.kind === 'source' && file.tags.includes('text') && findScope(file.path, scopes).path === scope,
        )) {
            const forms = syntaxes.filter((form) => form.covers(file));
            const source = readCachedBytes(input.reads, file.path).toString('utf8');
            const comments = await parseComments(file.path, source);
            found.push(
                ...comments.flatMap((comment, index) => {
                    const preceding = reasonAbove(comments[index - 1], comment);
                    const text = stripCommentEnd(comment.text);
                    return forms.flatMap((form): Finding[] => {
                        const marker = comment.standalone ? form.marker : form.inlineMarker;
                        if (!marker.test(text)) return [];
                        const at = { file: file.path, line: comment.line };
                        if (form.forbidden)
                            return [
                                findingAt(
                                    input,
                                    at,
                                    form.tool,
                                    `${form.tool} suppression is not allowed; fix the finding or configure an explicit ignore.`,
                                ),
                            ];
                        if (hasAcceptedReason(form, text, preceding)) return [];
                        return [
                            findingAt(
                                input,
                                at,
                                `${form.tool}-no-reason`,
                                `This ${form.tool} suppression has no reason of two or more words.`,
                            ),
                        ];
                    });
                }),
            );
        }
    }
    return found;
}

export { suppressions };
