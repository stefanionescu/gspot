import { buildFinding } from '#cli/runs/finding.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { getToolName } from '#cli/configurations/tools.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import type { SuppressionSyntax } from '#cli/types/checks/gspot.ts';
import type { SourceComment } from '#cli/types/parsers/comments.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { isReasonAccepted } from '#cli/settings/validation/reasons.ts';
import { parseComments, stripCommentEnd } from '#cli/parsers/comments.ts';
import type { Finding, CheckInput, FindingPlace } from '#cli/types/runs/check.ts';
import { REASON_ABOVE, SUPPRESSION_LIMITS, SUPPRESSION_DIRECTIVE_MESSAGES } from '#cli/config/checks/gspot.ts';

// A reason on the line above covers only the next line. Code or comments between them break the link.
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

// Only tools whose checks claim this source contribute suppression syntax.
function listSuppressionSyntaxes(selection: ScopeSelection): SuppressionSyntax[] {
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

// The lint rules that a directive of a tool with size limits names; undefined for any other comment.
function readDirectiveRules(tool: string, text: string): string | undefined {
    const limits = SUPPRESSION_LIMITS.get(tool);
    const directive = limits?.directive.exec(text);
    if (limits === undefined || directive === null || directive === undefined) return undefined;
    return (directive.groups?.['rules'] ?? '').split(limits.separator)[0];
}

// A directive that turns off every rule, or one that lifts a size or complexity limit.
function classifyDirective(tool: string, text: string): keyof typeof SUPPRESSION_DIRECTIVE_MESSAGES | undefined {
    const rules = readDirectiveRules(tool, text);
    const limits = SUPPRESSION_LIMITS.get(tool);
    if (rules === undefined || limits === undefined) return undefined;
    if (limits.allRules.test(rules.trim())) return 'all';
    return limits.lintRules.test(rules) ? 'limit' : undefined;
}

function hasAcceptedReason(form: SuppressionSyntax, text: string, preceding: string | undefined): boolean {
    const reason = form.reason.exec(text)?.groups?.['reason']?.trim() ?? preceding;
    return isReasonAccepted(reason);
}

function checkSuppressionComment(
    input: CheckInput,
    form: SuppressionSyntax,
    comment: SourceComment & FindingPlace,
    preceding: string | undefined,
): Finding[] {
    const text = stripCommentEnd(comment.text);
    const marker = comment.standalone ? form.marker : form.inlineMarker;
    if (!marker.test(text)) return [];
    const at = { file: comment.file, line: comment.line };
    if (form.forbidden)
        return [
            buildFinding(
                input,
                at,
                form.tool,
                `${form.tool} suppression is not allowed; fix the finding or configure an explicit ignore.`,
            ),
        ];
    const directive = classifyDirective(form.tool, text);
    if (directive !== undefined)
        return [buildFinding(input, at, `${form.tool}-${directive}`, SUPPRESSION_DIRECTIVE_MESSAGES[directive])];
    if (hasAcceptedReason(form, text, preceding)) return [];
    return [
        buildFinding(
            input,
            at,
            `${form.tool}-no-reason`,
            `This ${form.tool} suppression has no reason of two or more words.`,
        ),
    ];
}

/**
 * Reports forbidden suppressions and suppressions without a valid reason.
 *
 * @param input the files to scan, by scope.
 * @returns the findings.
 */
export async function checkSuppressions(input: CheckInput): Promise<Finding[]> {
    const scopes = input.selections.map((selection) => selection.scope);
    const selections = new Map(input.selections.map((selection) => [selection.scope.path, selection]));
    const found: Finding[] = [];
    for (const [scope, selection] of selections) {
        const syntaxes = listSuppressionSyntaxes(selection);
        for (const file of input.files.filter(
            (file) =>
                file.kind === 'source' && file.tags.includes('text') && findScope(file.path, scopes).path === scope,
        )) {
            const forms = syntaxes.filter((form) => form.covers(file));
            const source = readCachedBytes(input.reads, file.path).toString('utf8');
            const comments = await parseComments(file.path, source, file.tags);
            found.push(
                ...comments.flatMap((comment, index) => {
                    const preceding = findReasonAbove(comments[index - 1], comment);
                    return forms.flatMap((form) =>
                        checkSuppressionComment(input, form, { ...comment, file: file.path }, preceding),
                    );
                }),
            );
        }
    }
    return found;
}
