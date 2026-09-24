import { functionAt } from '#cli/structure/parser.ts';
// Multi-line ssh blocks: named, documented, inside a function. Searched: shellcheck; it does not read intent.
import type { Analysis, ScriptFile } from '#cli/types/structure.ts';
import {
    CLOSING_QUOTE_LINE,
    RUN_SSH_START,
    SSH_BLOCK_MIN_LINES,
    SSH_HEREDOC,
} from '#cli/structure/patterns.ts';

function unescapedQuotes(text: string, quote: string): number {
    let count = 0;
    for (let index = 0; index < text.length; index += 1)
        if (text.charAt(index) === quote && text.charAt(index - 1) !== '\\') count += 1;
    return count;
}

function isBlockStart(line: string): boolean {
    const match = RUN_SSH_START.exec(line);
    const quote = match?.groups?.['quote'];
    if (match === null || quote === undefined) return false;
    const after = line.slice(line.indexOf(match[0]) + match[0].length);
    return unescapedQuotes(after, quote) % 2 === 0;
}

function quotedBlocks(file: ScriptFile): { start: number; length: number }[] {
    const blocks: { start: number; length: number }[] = [];
    let open: { start: number; length: number } | undefined;
    for (const [index, line] of file.lines.entries()) {
        const trimmed = line.trimStart();
        if (open === undefined) {
            if (isBlockStart(trimmed)) open = { start: index + 1, length: 1 };
            continue;
        }
        open.length += 1;
        if (trimmed === '"' || trimmed === "'" || CLOSING_QUOTE_LINE.test(trimmed)) {
            blocks.push(open);
            open = undefined;
        }
    }
    return blocks;
}

/**
 * One finding per multi-line run_ssh block outside a function, and per ssh heredoc without a named comment above it.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptSshBlocks: Analysis = async (context, scripts) => {
    const index = await scripts();
    return index.files.flatMap((file) => {
        const quoted = quotedBlocks(file)
            .filter(
                (block) => block.length >= SSH_BLOCK_MIN_LINES && functionAt(file.functions, block.start) === undefined,
            )
            .map((block) =>
                context.report(
                    file.path,
                    block.start,
                    'unnamed-block',
                    `A ${String(block.length)}-line run_ssh block sits outside a named function.`,
                ),
            );
        const heredocs = file.lines.flatMap((line, position) => {
            if (!SSH_HEREDOC.test(line)) return [];
            const previous = (file.lines[position - 1] ?? '').trim();
            if (previous.startsWith('# ') && previous.includes(' - ')) return [];
            return [
                context.report(
                    file.path,
                    position + 1,
                    'undocumented-heredoc',
                    'An ssh heredoc carries a "# name - what it does" line above it.',
                ),
            ];
        });
        return [...quoted, ...heredocs];
    });
};
