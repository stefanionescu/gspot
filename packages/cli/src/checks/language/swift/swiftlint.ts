import { join } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { chmodSync, writeFileSync } from 'node:fs';
import { compact } from '#cli/platform/objects.ts';
import { copyFiles } from '#cli/execution/copy/files.ts';
import { visitSwiftSources } from '#cli/parsers/swift.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';
import { runCommandCheck } from '#cli/execution/command/runner.ts';
import type { InlineDocumentation } from '#cli/types/checks/language/swift.ts';
import { commandConfigurations } from '#cli/execution/command/placeholders.ts';
import { DOC_RULE, SWIFTLINT_COMMAND } from '#cli/config/checks/language/swift.ts';

// The grammar can expose comment-shaped extras inside strings. Those are literal content.
function isSourceComment(node: Node): boolean {
    for (let parent = node.parent; parent !== null; parent = parent.parent)
        if (parent.type.includes('string_literal') || parent.type.includes('regex_literal')) return false;
    return true;
}

// Preserve documentation and native suppression directives. Mask code that prevents SwiftLint
// from matching an inline documentation token, without changing its source coordinates.
function commentSource(text: string, comments: Node[]): string {
    const parts: string[] = [];
    let start = 0;
    for (const comment of comments) {
        if (!comment.text.startsWith('/**') && !comment.text.includes('swiftlint:')) continue;
        parts.push(
            text.slice(start, comment.startIndex).replaceAll(/[^\r\n]/gu, (value) => ' '.repeat(value.length)),
            comment.text,
        );
        start = comment.endIndex;
    }
    parts.push(text.slice(start).replaceAll(/[^\r\n]/gu, (value) => ' '.repeat(value.length)));
    return parts.join('');
}

function restoreInline(result: CheckResult, checked: CheckResult, candidates: InlineDocumentation[]): void {
    for (const { source, inline } of candidates) {
        for (const comment of inline) {
            const { row, column } = comment.startPosition;
            const native = checked.findings.find(
                (finding) => finding.file === source.path && finding.rule === DOC_RULE && finding.line === row + 1,
            );
            if (
                native === undefined ||
                result.findings.some(
                    (finding) =>
                        finding.file === source.path &&
                        finding.rule === DOC_RULE &&
                        finding.line === row + 1 &&
                        finding.column === column + 1,
                )
            )
                continue;
            result.findings.push({ ...native, line: row + 1, column: column + 1 });
        }
    }
}

/**
 * Keep native configuration and suppression handling while inspecting inline documentation with the Swift grammar.
 * @param session the selected source inventory and tool reads
 * @param planned the native check, scope, and selected files
 * @returns native findings with inline documentation positions restored
 */
export async function swiftlint(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const result = await runCommandCheck(session, planned, { command: SWIFTLINT_COMMAND });
    if (
        !['passed', 'failed'].includes(result.status) ||
        planned.scope.view.rulesOff(planned.spec.name).includes(DOC_RULE)
    )
        return result;
    return visitSwiftSources({ ...session, files: planned.files }, async ({ sources }) => {
        const candidates = sources.flatMap((source): InlineDocumentation[] => {
            const comments = source.tree.rootNode
                .descendantsOfType(['comment', 'multiline_comment'])
                .filter((node) => isSourceComment(node));
            const inline = comments.filter(
                (comment) =>
                    comment.type === 'multiline_comment' &&
                    comment.text.startsWith('/**') &&
                    (source.lines[comment.startPosition.row] ?? '').slice(0, comment.startPosition.column).trim() !==
                        '',
            );
            return inline.length === 0 ? [] : [{ source, comments, inline }];
        });
        if (candidates.length === 0) return result;
        using workspace = copyFiles(session.root, [
            ...session.repository.files.map((file) => file.path),
            ...commandConfigurations(session, planned, SWIFTLINT_COMMAND),
        ]);
        for (const { source, comments } of candidates) {
            const path = join(workspace.root, source.path);
            chmodSync(path, PRIVATE_FILE);
            writeFileSync(path, commentSource(source.text, comments));
        }
        const checked = await runCommandCheck({ ...session, root: workspace.root }, planned, {
            command: SWIFTLINT_COMMAND,
        });
        if (!['passed', 'failed'].includes(checked.status))
            return {
                ...result,
                status: checked.status,
                ...compact({ note: checked.note }),
                duration: performance.now() - started,
            };
        restoreInline(result, checked, candidates);
        if (result.findings.length > 0) result.status = 'failed';
        result.duration = performance.now() - started;
        return result;
    });
}
