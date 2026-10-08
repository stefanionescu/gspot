import { isDeepStrictEqual } from 'node:util';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import { POLICY_PROVENANCE_PREFIXES } from '#cli/config/policy/file.ts';
import { tomlRange, tomlCommentOwners } from '#cli/parsers/toml/contracts.ts';
import type { Comment, TomlSyntax, TomlComments, TomlCommentOwner } from '#cli/types/parsers/toml.ts';
import { valueAt, isRecord, createTable, isRecordArray, normalizeTables } from '#cli/platform/contracts.ts';

function sameValue(left: unknown, right: unknown): boolean {
    return isDeepStrictEqual(normalizeTables(left), normalizeTables(right));
}

function matchingPositions(
    original: readonly unknown[],
    values: readonly unknown[],
    position: number,
    path: KeyPath,
): number[] {
    const source = original[position];
    if (!isRecord(source)) {
        const matches = values.flatMap((value, index) => (sameValue(value, source) ? [index] : []));
        const occurrence = original.slice(0, position).filter((value) => sameValue(value, source)).length;
        const index = matches[occurrence] ?? matches[0];
        return index === undefined ? [] : [index];
    }
    const matches = values.flatMap((value, index) => {
        if (!isRecord(value)) return [];
        if (path[0] === 'ignore')
            return ['check', 'rule', 'reason'].every((key) => sameValue(source[key], value[key])) ? [index] : [];
        if (source['name'] !== undefined) return sameValue(source['name'], value['name']) ? [index] : [];
        return sameValue(source, value) ? [index] : [];
    });
    if (matches.length === 0) return path[0] === 'ignore' || position >= values.length ? [] : [position];
    return matches.toSorted(
        (left, right) =>
            Number(!sameValue(source['until'], valueAt(values[left], ['until']))) -
            Number(!sameValue(source['until'], valueAt(values[right], ['until']))),
    );
}

function destinations(syntax: TomlSyntax, target: TomlTable, path: KeyPath): KeyPath[] {
    let mapped: KeyPath[] = [[]];
    for (const [index, key] of path.entries()) {
        if (typeof key === 'string') {
            mapped = mapped.map((candidate) => [...candidate, key]);
            continue;
        }
        const prior: unknown = valueAt(syntax.value, path.slice(0, index));
        if (!Array.isArray(prior)) return [];
        const original: readonly unknown[] = prior;
        mapped = mapped.flatMap((candidate) => {
            const next: unknown = valueAt(target, candidate);
            if (!Array.isArray(next)) return [];
            const values: readonly unknown[] = next;
            return matchingPositions(original, values, key, path).map((position) => [...candidate, position]);
        });
    }
    return mapped.filter((candidate) => valueAt(target, candidate) !== undefined);
}

function commentTarget(syntax: TomlSyntax, target: TomlTable, authored: TomlTable, owner: TomlCommentOwner) {
    const path = destinations(syntax, target, owner.path)[0];
    if (path === undefined) {
        if (owner.kind === 'item' || valueAt(authored, owner.path) === undefined) return { kind: owner.kind, path };
        const [header] = [
            syntax.entries.findLast(
                (entry) => entry.kind === 'header' && entry.path.every((key, index) => owner.path[index] === key),
            ),
        ].flatMap((entry) => (entry?.path.every((key) => typeof key === 'string') === true ? [entry.path] : []));
        if (header === undefined) return { kind: 'preamble', path: [] };
        createTable(target, header);
        return { kind: 'header', path: header };
    }
    if (owner.kind !== 'key') return { kind: owner.kind, path };
    const value: unknown = valueAt(target, path);
    if (isRecord(value)) return { kind: 'header', path };
    if (isRecordArray(value)) return { kind: 'header', path: [...path, 0] };
    return { kind: owner.kind, path };
}

function addComment(
    comments: TomlComments,
    kind: string,
    path: KeyPath | undefined,
    comment: Comment,
    placement: 'owned' | 'free',
): void {
    if (path === undefined) return;
    const id = JSON.stringify([kind, ...path]);
    const block = comments.get(id) ?? { path, owned: [], free: [] };
    block[kind === 'preamble' ? 'free' : placement].push({
        raw: comment.raw,
        start: tomlRange(comment)[0],
        line: comment.loc.start.line,
    });
    comments.set(id, block);
}

/**
 * Keep exact physical comments on their surviving semantic owner before records merge or move.
 * An ambiguous split gives its general comments to the first canonical row; path comments follow their own values.
 * @param syntax the original keys, headers and native values
 * @param target the canonical authored values
 * @param authored the draft before omission of native defaults
 * @returns source-ordered owned blocks and separately anchored free prose
 */
export function policyComments(syntax: TomlSyntax, target: TomlTable, authored: TomlTable): TomlComments {
    const comments: TomlComments = new Map();
    for (const { comment, owner } of tomlCommentOwners(syntax)) {
        if (POLICY_PROVENANCE_PREFIXES.some((prefix) => comment.raw.startsWith(prefix))) {
            addComment(comments, comment.raw.startsWith('#:schema ') ? 'schema' : 'provenance', [], comment, 'owned');
            continue;
        }
        if (owner !== undefined) {
            const mapped = commentTarget(syntax, target, authored, owner);
            addComment(comments, mapped.kind, mapped.path, comment, 'owned');
            continue;
        }
        const next = syntax.entries.find(
            (entry) =>
                tomlRange(entry.node)[0] > tomlRange(comment)[1] && destinations(syntax, target, entry.path).length > 0,
        );
        const anchor = commentTarget(syntax, target, authored, next ?? { kind: 'preamble', path: [] });
        addComment(comments, anchor.kind, anchor.path, comment, 'free');
    }
    return comments;
}
