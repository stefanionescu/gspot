import { buildFinding } from '#cli/runs/finding.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { getToolName } from '#cli/configurations/tools.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { ISO_DATE_LENGTH } from '#cli/config/settings/values.ts';
import type { SuppressionSyntax } from '#cli/types/checks/gspot.ts';
import type { SourceComment } from '#cli/types/parsers/comments.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { Finding, FindingPlace } from '#cli/types/runs/check.ts';
import { isReasonAccepted } from '#cli/settings/validation/reasons.ts';
import { parseComments, stripCommentEnd } from '#cli/parsers/comments.ts';
import { getTomlRange, parseTomlSyntax } from '#cli/parsers/toml/comments.ts';
import { REASON_ABOVE, EXPIRED_IGNORE_HELP, SUPPRESSION_KIND_MESSAGES } from '#cli/config/checks/gspot.ts';

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
            separator: definition.separator === undefined ? undefined : new RegExp(definition.separator, 'u'),
            allRules: definition.all_rules === undefined ? undefined : new RegExp(definition.all_rules, 'u'),
            limitRules: definition.limit_rules === undefined ? undefined : new RegExp(definition.limit_rules, 'u'),
        };
    });
}

// The rules named by a suppression with a size-limit grammar; undefined for any other comment.
function parseSuppressionRules(form: SuppressionSyntax, text: string): string | undefined {
    if (form.separator === undefined) return undefined;
    const suppression = form.marker.exec(text);
    if (suppression === null) return undefined;
    return (suppression.groups?.['rules'] ?? '').split(form.separator)[0];
}

// A suppression that turns off every rule, or one that lifts a size or complexity limit.
function classifySuppression(
    form: SuppressionSyntax,
    text: string,
): keyof typeof SUPPRESSION_KIND_MESSAGES | undefined {
    const rules = parseSuppressionRules(form, text);
    if (rules === undefined) return undefined;
    if (form.allRules?.test(rules.trim()) === true) return 'all';
    return form.limitRules?.test(rules) === true ? 'limit' : undefined;
}

function hasAcceptedReason(form: SuppressionSyntax, text: string, preceding: string | undefined): boolean {
    const reason = form.reason.exec(text)?.groups?.['reason']?.trim() ?? preceding;
    return isReasonAccepted(reason);
}

function checkSuppressionComment(
    planned: PlannedCheck,
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
                planned,
                at,
                form.tool,
                `${form.tool} suppression is not allowed; fix the finding or configure an explicit ignore.`,
            ),
        ];
    const kind = classifySuppression(form, text);
    if (kind !== undefined) return [buildFinding(planned, at, `${form.tool}-${kind}`, SUPPRESSION_KIND_MESSAGES[kind])];
    if (hasAcceptedReason(form, text, preceding)) return [];
    return [
        buildFinding(
            planned,
            at,
            `${form.tool}-no-reason`,
            `This ${form.tool} suppression has no reason of two or more words.`,
        ),
    ];
}

function listExpiredIgnores(session: Session, planned: PlannedCheck): Finding[] {
    const { settings, text } = session.settingsFile;
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    const expired = new Map(
        settings.ignore.flatMap((entry, index) => {
            const date = entry.until?.toISOString();
            return date === undefined || today < date ? [] : [[index, { entry, date }] as const];
        }),
    );
    if (expired.size === 0) return [];
    return parseTomlSyntax(text, settings.written).pathNodes.flatMap(({ path: [table, index, ...keys], node }) => {
        if (table !== 'ignore' || typeof index !== 'number' || keys.length > 0) return [];
        const ignore = expired.get(index);
        if (ignore === undefined) return [];
        const line = text.slice(0, getTomlRange(node)[0]).split('\n').length;
        return [
            buildFinding(
                planned,
                { file: SETTINGS_FILE, line },
                'expired-ignore',
                `This ignore of ${ignore.entry.check ?? 'every check'} ended on ${ignore.date}.`,
                { help: EXPIRED_IGNORE_HELP },
            ),
        ];
    });
}

/**
 * Reports forbidden suppressions and suppressions without a valid reason.
 *
 * @param session the repository and its tools.
 * @param planned the files to scan, by scope.
 * @returns the findings.
 */
export async function checkSuppressions(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scopes = session.scopes.map((selection) => selection.scope);
    const selections = new Map(session.scopes.map((selection) => [selection.scope.path, selection]));
    const found: Finding[] = listExpiredIgnores(session, planned);
    for (const [scope, selection] of selections) {
        const syntaxes = listSuppressionSyntaxes(selection);
        for (const file of planned.files.filter(
            (file) =>
                file.kind === 'source' && file.tags.includes('text') && findScope(file.path, scopes).path === scope,
        )) {
            const forms = syntaxes.filter((form) => form.covers(file));
            const source = readCachedText(session.reads, file.path);
            const comments = await parseComments(file.path, source, file.tags);
            found.push(
                ...comments.flatMap((comment, index) => {
                    const preceding = findReasonAbove(comments[index - 1], comment);
                    return forms.flatMap((form) =>
                        checkSuppressionComment(planned, form, { ...comment, file: file.path }, preceding),
                    );
                }),
            );
        }
    }
    return found;
}
