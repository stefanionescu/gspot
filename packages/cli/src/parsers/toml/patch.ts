import { isDeepStrictEqual } from 'node:util';
import { isComment } from '#cli/parsers/toml/nodes.ts';
import { PATCH_FORMAT } from '#cli/config/parsers/toml.ts';
import { patch, parseDocument } from '@decimalturn/toml-patch';
import type { Comment, TomlBlock } from '#cli/types/parsers/toml.ts';

// Own-line comments without an intervening blank line describe the following table.
function tableComments(nodes: TomlBlock[], line: number): Comment[] {
    const comments: Comment[] = [];
    let precedingLine = line;
    for (const node of nodes.toReversed()) {
        if (!isComment(node) || node.loc.end.line + 1 !== precedingLine) break;
        comments.unshift(node);
        precedingLine = node.loc.start.line;
    }
    return comments;
}

// Locate the original comment block nearest its table, even when new assignments interrupt it.
function matchingComments(nodes: TomlBlock[], comments: Comment[], before: number): Comment[] {
    let found: Comment[] = [];
    for (let index = 0; index <= before - comments.length; index++) {
        const candidates = nodes.slice(index, index + comments.length);
        if (
            candidates.every(isComment) &&
            isDeepStrictEqual(
                candidates.map((node) => node.raw),
                comments.map((node) => node.raw),
            )
        )
            found = candidates;
    }
    return found;
}

/**
 * Edit TOML values while keeping comments above the first table attached to that table.
 * New root assignments belong before those comments, so removing an assignment cannot remove authored prose.
 * @param source the authored document
 * @param entries the resulting values
 * @returns the edited TOML with table comments in their original ownership
 */
export function patchToml(source: string, entries: Record<string, unknown>): string {
    const output = patch(source, entries, PATCH_FORMAT);
    const nodes = parseDocument(source).cst;
    const tableIndex = nodes.findIndex((node) => 'items' in node);
    const table = nodes[tableIndex];
    if (table === undefined || !('items' in table)) return output;
    const comments = tableComments(nodes.slice(0, tableIndex), table.loc.start.line);
    if (comments.length === 0) return output;
    const nextNodes = parseDocument(output).cst;
    const nextTableIndex = nextNodes.findIndex(
        (node) =>
            isDeepStrictEqual(node.type, table.type) &&
            'items' in node &&
            isDeepStrictEqual(node.key.item.value, table.key.item.value),
    );
    const nextTable = nextNodes[nextTableIndex];
    if (nextTable === undefined) return output;
    const matched = matchingComments(nextNodes, comments, nextTableIndex);
    const firstComment = matched.at(0);
    const lastComment = matched.at(-1);
    if (
        firstComment === undefined ||
        lastComment === undefined ||
        lastComment.loc.end.line + 1 === nextTable.loc.start.line
    )
        return output;
    const lines = output.split(/(?<=\n)/u);
    const first = firstComment.loc.start.line - 1;
    const end = lastComment.loc.end.line;
    const destination = nextTable.loc.start.line - 1;
    const block = lines.splice(first, end - first);
    lines.splice(destination - block.length, 0, ...block);
    return lines.join('');
}
