import { patch } from '@decimalturn/toml-patch';
import { tomlRange } from '#cli/parsers/toml/nodes.ts';
import { PATCH_FORMAT } from '#cli/config/parsers/toml.ts';
import type { TomlSyntax, TomlComments, TomlTextChunk } from '#cli/types/parsers/toml.ts';
import { tomlSyntax, emitTomlComments, tomlCommentOwners } from '#cli/parsers/toml/comments.ts';

/**
 * Patch managed tool values and retain comments on their original semantic owners.
 * Native chunks keep their authored order and formatting.
 * @param original indexed authored source before edits
 * @param values the resulting native values
 * @returns the native edited document with its owned comments
 */
export function patchToml(original: TomlSyntax, values: Record<string, unknown>): string {
    const patched = patch(original.document.toTomlString, values, PATCH_FORMAT);
    const current = tomlSyntax(patched, values);
    const unmatched = new Set(tomlCommentOwners(current));
    const retained = new Set(current.entries.map(({ kind, path }) => JSON.stringify([kind, ...path])));
    const comments: TomlComments = new Map();
    const changed = tomlCommentOwners(original)
        .map((source) => {
            const found = [...unmatched].find((candidate) => candidate.comment.raw === source.comment.raw);
            if (found !== undefined) unmatched.delete(found);
            return { source, found };
        })
        .filter(({ source, found }) => found?.identity !== source.identity);
    const chunks = changed.flatMap(({ source: { comment, owner: authored }, found }): TomlTextChunk[] => {
        const owner =
            authored ??
            original.entries.find(
                (entry) =>
                    tomlRange(entry.node)[0] > tomlRange(comment)[1] &&
                    retained.has(JSON.stringify([entry.kind, ...entry.path])),
            );
        if (owner === undefined) return [];
        const key = JSON.stringify([owner.kind, ...owner.path]);
        if (!retained.has(key)) return [];
        const block = comments.get(key) ?? { path: owner.path, owned: [], free: [] };
        block[authored === undefined ? 'free' : 'owned'].push({
            raw: comment.raw,
            start: tomlRange(comment)[0],
            line: comment.loc.start.line,
        });
        comments.set(key, block);
        if (found === undefined) return [];
        const [start, end] = tomlRange(found.comment);
        return [{ start, end: end + Number(patched[end] === '\n'), text: '' }];
    });
    for (const entry of current.entries) {
        const text = emitTomlComments(comments, entry.kind, entry.path, '');
        if (text === '') continue;
        const start = tomlRange(entry.node)[0];
        chunks.push({ start, end: start, text: text + '\n' });
    }
    let position = 0;
    return (
        chunks
            .toSorted((left, right) => left.start - right.start)
            .map((chunk) => {
                const retained = patched.slice(position, chunk.start) + chunk.text;
                position = chunk.end;
                return retained;
            })
            .join('') + patched.slice(position)
    );
}
