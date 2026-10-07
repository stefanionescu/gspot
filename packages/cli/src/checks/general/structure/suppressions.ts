// Validate suppression comments against the repository reason policy.
import { findingAt } from '#cli/checks/finding.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { readSource } from '#cli/platform/source.ts';
import { toolName } from '#cli/configurations/pins.ts';
import { ownedBy } from '#cli/configurations/owners.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { isReasonAccepted } from '#cli/policy/errors/reasons.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { SourceComment } from '#cli/types/parsers/comments.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { commentText, parseComments } from '#cli/parsers/comments.ts';
import type { SuppressionForm } from '#cli/types/checks/general/structure.ts';
import type { EngineInput, SuppressionComment } from '#cli/types/execution/check.ts';

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
                ownedBy(check.files ?? manifest.files, selected, [file], selection.scope.path).length === 0
                    ? []
                    : [toolName(check)],
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
 * Finds suppression comments using the syntax of the tools that check each file.
 * @param root the repository root
 * @param selections the resolved scopes
 * @param reads the source reads shared across checks
 * @param files the tracked files
 * @returns every suppression comment with its tool, reason, and whether it is forbidden
 */
export async function suppressionComments(
    root: string,
    selections: ScopeSelection[],
    reads: ReadCache,
    files: TrackedFile[],
): Promise<SuppressionComment[]> {
    const scopes = selections.map((selection) => selection.scope);
    const found: SuppressionComment[] = [];
    for (const file of files) {
        const scope = scopeOf(file.path, scopes);
        const selection = selections.find((candidate) => candidate.scope.path === scope.path);
        if (selection === undefined) throw new Error(`No selection covers the scope ${scope.path}.`);
        const forms = suppressionForms(selection, file);
        const source = readSource(root, file.path, reads).toString('utf8');
        const comments = await parseComments(file.path, source);
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
export async function suppressions(input: EngineInput): Promise<Finding[]> {
    if (input.selections === undefined)
        throw new Error('The suppressions check needs every scope selection. Its manifest must say runs = "once".');
    const comments = await suppressionComments(
        input.root,
        input.selections,
        input.reads,
        input.files.filter((file) => file.kind === 'source' && file.tags.includes('text')),
    );
    return comments.flatMap((entry): Finding[] => {
        const at = { file: entry.file, line: entry.line };
        if (entry.forbidden)
            return [
                findingAt(
                    input,
                    at,
                    entry.form,
                    `${entry.form} suppression is not allowed; fix the finding or configure an explicit ignore.`,
                ),
            ];
        if (!input.policyFiles.policy.require_reasons) return [];
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
