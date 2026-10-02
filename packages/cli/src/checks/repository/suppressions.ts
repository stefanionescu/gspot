// Validate suppression comments against the repository reason policy.
import { ownedBy } from '#cli/kits/owners.ts';
import { findingAt } from '#cli/checks/result.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import { readSource } from '#cli/repository/sources.ts';
import { isReasonAccepted } from '#cli/policy/weaker.ts';
import type { ScopeSelection } from '#cli/types/policy/policy.ts';
import type { SourceComment } from '#cli/types/parsers/parsers.ts';
import { commentText, sourceComments } from '#cli/parsers/comments.ts';
import { COMMENT_STYLE_BY_EXTENSION } from '#cli/config/execution/execution.ts';
import type { SourceReads, TrackedFile } from '#cli/types/repository/repository.ts';
import type { Finding, EngineInput, SuppressionForm, SuppressionComment } from '#cli/types/checks.ts';

// A preceding reason belongs only to the next line. Intervening source or comments break adjacency.
function reasonAbove(previous: SourceComment | undefined, comment: SourceComment): string | undefined {
    if (
        previous === undefined ||
        !previous.standalone ||
        previous.line + 1 !== comment.line ||
        previous.text.includes('\n')
    )
        return undefined;
    const text = commentText(previous.text);
    return /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u.exec(text)?.groups?.['reason']?.trim();
}

// Only tools whose checks claim this source contribute suppression syntax.
function suppressionForms(selection: ScopeSelection, file: TrackedFile): SuppressionForm[] {
    const { selected } = selection;
    const readers = new Set(
        selected.flatMap((manifest) =>
            manifest.checks.flatMap((check) =>
                ownedBy(check.owners ?? manifest.owners, selected, [file], selection.scope.path).length === 0
                    ? []
                    : [check.tool ?? check.command?.[0]],
            ),
        ),
    );
    const definitions = new Map(
        selected.flatMap((manifest) =>
            manifest.tools.flatMap((tool) =>
                tool.suppression === undefined || !readers.has(tool.name)
                    ? []
                    : [[tool.name, tool.suppression] as const],
            ),
        ),
    );
    return [...definitions].map(([form, definition]) => ({
        form,
        marker: new RegExp(definition.marker, 'u'),
        inlineMarker: new RegExp(definition.inline_marker ?? definition.marker, 'u'),
        reason: new RegExp(definition.reason, 'u'),
        forbidden: definition.forbidden === true,
    }));
}

/**
 * Read comments once through the selected tool definitions for each file scope.
 * @param root the repository root
 * @param selections the resolved scopes
 * @param reads the source reads shared across checks
 * @param files the tracked files
 * @returns every suppression comment with its tool, reason, and whether it is forbidden
 */
export async function suppressionComments(
    root: string,
    selections: ScopeSelection[],
    reads: SourceReads,
    files: TrackedFile[],
): Promise<SuppressionComment[]> {
    const scopes = selections.map((selection) => selection.scope);
    const found: SuppressionComment[] = [];
    for (const file of files) {
        const style = COMMENT_STYLE_BY_EXTENSION[extensionOf(file.path)];
        if (style === undefined) continue;
        const scope = scopeOf(file.path, scopes);
        const selection = selections.find((candidate) => candidate.scope.path === scope.path);
        if (selection === undefined) throw new Error(`No selection covers the scope ${scope.path}.`);
        const forms = suppressionForms(selection, file);
        const source = readSource(root, file.path, reads).toString('utf8');
        const comments = await sourceComments(file.path, source);
        found.push(
            ...comments.flatMap((comment, index) => {
                const preceding = reasonAbove(comments[index - 1], comment);
                const text = commentText(comment.text);
                return forms.flatMap((form): SuppressionComment[] => {
                    const marker = comment.standalone ? form.marker : form.inlineMarker;
                    if (!marker.test(text)) return [];
                    const reason = form.reason.exec(text)?.groups?.['reason']?.trim() ?? preceding;
                    return [
                        {
                            file: file.path,
                            line: comment.line,
                            form: form.form,
                            forbidden: form.forbidden,
                            ...(reason === undefined ? {} : { reason }),
                        },
                    ];
                });
            }),
        );
    }
    return found;
}

/**
 * Report forbidden suppressions and missing or invalid required reasons.
 * @param input the engine input with the read suppression comments
 * @returns the findings
 */
export function suppressions(input: EngineInput): Finding[] {
    if (input.suppressions === undefined) throw new Error('Suppression validation requires once-only execution.');
    return input.suppressions.flatMap((entry): Finding[] => {
        const at = { file: entry.file, line: entry.line };
        if (entry.forbidden && input.policyFiles.policy.level === 'all')
            return [
                findingAt(
                    input,
                    at,
                    entry.form,
                    `${entry.form} suppression is not allowed; fix the finding or configure an explicit ignore.`,
                ),
            ];
        if (!input.policyFiles.policy.requireReasons) return [];
        if (isReasonAccepted(entry.reason)) return [];
        return [
            findingAt(
                input,
                at,
                `${entry.form}-no-reason`,
                `This ${entry.form} suppression needs a meaningful reason.`,
            ),
        ];
    });
}
