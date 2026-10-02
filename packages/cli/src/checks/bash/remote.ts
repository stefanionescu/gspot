import { findingAt } from '#cli/checks/result.ts';
import { functionAt } from '#cli/checks/bash/parser.ts';
import type { ScriptFile, StructureAnalysis as Analysis } from '#cli/types/checks.ts';
import { SSH_HEREDOC, CLOSING_QUOTE_LINE, SSH_BLOCK_MIN_LINES } from '#cli/config/checks/structure.ts';

// Quotes close in pairs.
const PAIR = 2;

function unescapedQuotes(text: string, quote: string): number {
    let count = 0;
    for (let index = 0; index < text.length; index += 1)
        if (text.charAt(index) === quote && text.charAt(index - 1) !== '\\') count += 1;
    return count;
}

// A call of a remote function that opens a quoted block: the function names come from tools.bash.remote_functions.
function blockStart(names: string[]): RegExp | undefined {
    if (names.length === 0) return undefined;
    const alternatives = names.map((name) => name.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)).join('|');
    return new RegExp(String.raw`\b(?:${alternatives})\s+(?<quote>["'])`, 'u');
}

function isBlockStart(line: string, start: RegExp): boolean {
    const match = start.exec(line);
    const quote = match?.groups?.['quote'];
    if (match === null || quote === undefined) return false;
    const after = line.slice(line.indexOf(match[0]) + match[0].length);
    return unescapedQuotes(after, quote) % PAIR === 0;
}

function quotedBlocks(file: ScriptFile, start: RegExp): { start: number; length: number }[] {
    const blocks: { start: number; length: number }[] = [];
    let open: { start: number; length: number } | undefined;
    for (const [index, line] of file.lines.entries()) {
        const trimmed = line.trimStart();
        if (open === undefined) {
            if (isBlockStart(trimmed, start)) open = { start: index + 1, length: 1 };
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
 * One finding per multi-line block a remote function runs outside a named function, and per ssh heredoc without a named
 * comment above it.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptRemote: Analysis = async (context, scripts) => {
    const start = blockStart(context.bashList('remote_functions'));
    const index = await scripts();
    return index.files.flatMap((file) => {
        const quoted = (start === undefined ? [] : quotedBlocks(file, start))
            .filter(
                (block) => block.length >= SSH_BLOCK_MIN_LINES && functionAt(file.functions, block.start) === undefined,
            )
            .map((block) =>
                findingAt(
                    context.input,
                    { file: file.path, line: block.start },
                    'unnamed-block',
                    `A ${String(block.length)}-line remote block sits outside a named function.`,
                ),
            );
        const heredocs = file.lines.flatMap((line, position) => {
            if (!SSH_HEREDOC.test(line)) return [];
            const previous = (file.lines[position - 1] ?? '').trim();
            if (previous.startsWith('# ') && previous.includes(' - ')) return [];
            return [
                findingAt(
                    context.input,
                    { file: file.path, line: position + 1 },
                    'undocumented-heredoc',
                    'An ssh heredoc carries a "# name - what it does" line above it.',
                ),
            ];
        });
        return [...quoted, ...heredocs];
    });
};
