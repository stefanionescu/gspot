// Every tracked path has one nature: source, generated, vendored, binary.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GENERATED_BANNERS, VENDORED_DIRECTORIES } from '#config/patterns.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { head } from '#cli/repository/tracked.ts';
import type { DeclareEntry } from '#types/config.ts';
import type { Nature } from '#types/repository.ts';

export type NatureVerdict = { nature: Nature; source: string; producedBy?: string };

type Attribute = { matcher: (path: string) => boolean; attributes: string[] };

function parseGitattributes(root: string): Attribute[] {
    const path = join(root, '.gitattributes');
    if (!existsSync(path)) return [];
    const rules: Attribute[] = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        const [pattern, ...attributes] = trimmed.split(/\s+/);
        if (!pattern) continue;
        const glob = pattern.includes('/') ? pattern.replace(/^\//, '') : `**/${pattern}`;
        rules.push({ matcher: pathMatcher([glob]), attributes });
    }
    return rules;
}

let attributeCache: { root: string; rules: Attribute[] } | undefined;

function attributesFor(root: string, path: string): string[] {
    if (!attributeCache || attributeCache.root !== root) attributeCache = { root, rules: parseGitattributes(root) };
    const found: string[] = [];
    for (const rule of attributeCache.rules) if (rule.matcher(path)) found.push(...rule.attributes);
    return found;
}

/** Decides the nature of one path in the order the design fixes: declarations, .gitattributes, banners, vendored directories, the binary sniff. */
export function natureOf(
    root: string,
    path: string,
    declares: DeclareEntry[],
    binary: boolean,
    isText: boolean,
): NatureVerdict {
    for (const entry of declares) {
        if (!pathMatcher(entry.paths)(path)) continue;
        if (entry.produced_by !== undefined)
            return { nature: 'generated', source: 'declare', producedBy: entry.produced_by };
        if (entry.vendored) return { nature: 'vendored', source: 'declare' };
    }
    const attributes = attributesFor(root, path);
    if (attributes.includes('linguist-generated') || attributes.includes('linguist-generated=true'))
        return { nature: 'generated', source: '.gitattributes' };
    if (attributes.includes('linguist-vendored') || attributes.includes('linguist-vendored=true'))
        return { nature: 'vendored', source: '.gitattributes' };
    if (
        attributes.includes('-text') ||
        attributes.includes('binary') ||
        attributes.some((attribute) => attribute.startsWith('filter=lfs'))
    )
        return { nature: 'binary', source: '.gitattributes' };
    if (binary) return { nature: 'binary', source: 'content' };
    if (isText) {
        const start = head(root, path, 1024);
        if (GENERATED_BANNERS.some((banner) => banner.test(start))) return { nature: 'generated', source: 'banner' };
    }
    const segments = path.split('/');
    if (segments.slice(0, -1).some((segment) => VENDORED_DIRECTORIES.includes(segment)))
        return { nature: 'vendored', source: 'directory' };
    return { nature: 'source', source: 'default' };
}

/** Drops the .gitattributes cache; tests use it after planting a file. */
export function resetNatures(): void {
    attributeCache = undefined;
}
