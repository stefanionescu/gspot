import { posix } from 'node:path';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import type { NoPrefixCollisionsOptions } from '#plugin/types/rules.ts';
import { DEFAULT_IGNORED, DEFAULT_THRESHOLD } from '#plugin/constants/rules.ts';

import {
    isIndexFile,
    lintedFile,
    lintedRoot,
    isAnyGlobMatch,
    prefixOf,
    readDirectory,
    relativeToRoot,
    stemOf,
} from '#plugin/files.ts';

function isInScope(relative: string, scope: string[], ignored: string[]): boolean {
    const segments = relative.split('/');
    if (ignored.some((segment) => segments.includes(segment))) return false;
    return scope.length === 0 || scope.some((segment) => segments.slice(0, -1).includes(segment));
}

export const noPrefixCollisions = createRule<NoPrefixCollisionsOptions, 'collision'>({
    name: 'no-prefix-collisions',
    meta: {
        type: 'problem',
        docs: {
            level: 'all',
            title: 'Avoid repeated file prefixes',
            example:
                'Sibling files `asset-card.ts`, `asset-list.ts`, and `asset-row.ts` report a shared `asset` prefix at the default threshold. Move them into `asset/` as `card.ts`, `list.ts`, and `row.ts`, and update every import.',
            summary:
                'Finds sibling files or folders that share a name prefix, like asset-card, asset-list and asset-row in one folder. Alternate formats of one basename count as one owner.',
            why: 'Files that share a prefix are one concept split by suffix; they belong in a folder named after the prefix.',
            fix: 'Move the entries into a folder named after the shared prefix and drop the prefix from their names, or allow the set with a reason under structure.prefix_collision_allowed.',
        },
        schema: [
            optionsSchema({
                threshold: { type: 'integer', minimum: 1 },
                scope: { type: 'array', items: { type: 'string' } },
                ignorePaths: { type: 'array', items: { type: 'string' } },
                allow: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: {
            collision:
                '{{names}} share the prefix "{{prefix}}". Group them in a folder named {{prefix}} and drop the prefix, or allow the set with a reason.',
        },
    },
    defaultOptions: [{ threshold: DEFAULT_THRESHOLD, scope: [], ignorePaths: DEFAULT_IGNORED, allow: [] }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined || isIndexFile(file)) return {};
        const relative = relativeToRoot(lintedRoot(context), file);
        const ignored = options.ignorePaths ?? DEFAULT_IGNORED;
        const prefix = prefixOf(stemOf(file));
        const directory = posix.dirname(relative);
        const allowed = options.allow ?? [];
        const isAllowed = [directory, `${directory}/`].some((path) => isAnyGlobMatch(path, allowed));
        const scope = options.scope ?? [];
        const threshold = options.threshold ?? DEFAULT_THRESHOLD;
        return {
            Program(node) {
                if (prefix === '' || !isInScope(relative, scope, ignored) || isAllowed) return;
                const peers = readDirectory(posix.dirname(file)).filter((entry) => {
                    if (entry.kind === 'dir')
                        return (
                            !entry.name.startsWith('.') &&
                            !ignored.includes(entry.name) &&
                            prefixOf(entry.name) === prefix
                        );
                    const stem = stemOf(entry.name);
                    return stem !== 'index' && prefixOf(stem) === prefix;
                });
                if (
                    new Set(peers.map((entry) => (entry.kind === 'dir' ? `${entry.name}/` : stemOf(entry.name)))).size <
                    threshold
                )
                    return;
                context.report({
                    node,
                    messageId: 'collision',
                    data: {
                        prefix,
                        names: peers.map((entry) => (entry.kind === 'dir' ? `${entry.name}/` : entry.name)).join(', '),
                    },
                });
            },
        };
    },
});
