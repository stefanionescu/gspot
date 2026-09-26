import { join } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { chmodSync, writeFileSync } from 'node:fs';
import type { CheckResult } from '#cli/checks/result.ts';
import type { Session } from '#cli/execution/session.ts';
import type { PlannedCheck } from '#cli/execution/plan.ts';
import { PRIVATE_FILE } from '#cli/platform/file-modes.ts';
import { swiftSources } from '#cli/checks/swift/sources.ts';
import { runToolCheck } from '#cli/execution/tool-runner.ts';
import { createFileWorkspace } from '#cli/execution/file-workspace.ts';
import { commandConfigurations } from '#cli/execution/command-expansion.ts';

const DOC_RULE = 'doc_comment_style';
const COMMAND = ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', '{files}'];

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

/**
 * Keep native configuration and suppression handling while inspecting inline documentation with the Swift grammar.
 * @param session the selected source inventory and tool observations
 * @param planned the native check, scope, and selected files
 * @returns native findings with inline documentation positions restored
 */
export async function checkSwiftlint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const result = await runToolCheck(session, planned, COMMAND);
    if (!['ok', 'fail'].includes(result.status) || planned.scope.view.rulesOff(planned.check).includes(DOC_RULE))
        return result;
    const sources = await swiftSources({ ...session, files: planned.files });
    try {
        const candidates = sources.flatMap((source) => {
            const comments = source.tree.rootNode
                .descendantsOfType(['comment', 'multiline_comment'])
                .filter(isSourceComment);
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
        using workspace = createFileWorkspace(session.root, [
            ...session.repository.files.map((file) => file.path),
            ...commandConfigurations(session, planned, COMMAND),
        ]);
        for (const { source, comments } of candidates) {
            const path = join(workspace.root, source.path);
            chmodSync(path, PRIVATE_FILE);
            writeFileSync(path, commentSource(source.text, comments));
        }
        const checked = await runToolCheck({ ...session, root: workspace.root }, planned, COMMAND);
        if (!['ok', 'fail'].includes(checked.status))
            return {
                ...result,
                status: checked.status,
                ...(checked.note === undefined ? {} : { note: checked.note }),
                duration: performance.now() - started,
            };
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
        if (result.findings.length > 0) result.status = 'fail';
        result.duration = performance.now() - started;
        return result;
    } finally {
        for (const source of sources) source.tree.delete();
    }
}
