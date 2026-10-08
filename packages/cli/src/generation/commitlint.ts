import { posix } from 'node:path';
import { openRoot } from '#cli/platform/root/open.ts';
import { parseJsonRecord } from '#cli/parsers/json.ts';
import { relativeTarget } from '#cli/generation/pointers.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { GeneratedFile, EmittedToolFile } from '#cli/types/generation/files.ts';

/**
 * Redirects authored package Commitlint fields to the applicable repository configuration.
 * @param root the repository root.
 * @param inventory authored files that may contain package settings.
 * @param generated the files emitted for checks applicable at the selected level.
 * @returns the managed package fields.
 */
export function commitlintChanges(
    root: string,
    inventory: TrackedFile[],
    generated: GeneratedFile[],
): EmittedToolFile[] {
    const target = generated.find((file) => file.path === '.gspot/config/commitlint.config.cjs');
    if (target === undefined) return [];
    using files = openRoot(root);
    const packages = new Set([
        'package.json',
        ...inventory
            .filter((file) => file.kind === 'source' && posix.basename(file.path) === 'package.json')
            .map((file) => file.path),
    ]);
    const changes: EmittedToolFile[] = [];
    for (const path of packages) {
        const source = files.read(path);
        if (source === undefined) continue;
        const document = parseJsonRecord(source.bytes.toString('utf8'));
        if (!Object.hasOwn(document, 'commitlint')) continue;
        changes.push({
            path,
            changes: [{ path: ['commitlint'], value: { extends: [relativeTarget(path, target.path)] } }],
        });
    }
    return changes;
}
