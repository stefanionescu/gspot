// The detection table: what the tree proposes at init and in doctor. Detection never selects.
import * as linguistLanguages from 'linguist-languages';

import { SHEBANG_INTERPRETERS } from '#config/patterns.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import type { Manifest } from '#types/manifest.ts';
import type { ManifestFacts, TrackedFile } from '#types/repository.ts';

export type Proposal = { preset: string; evidence: string; kind: string; count?: number };

export type UnknownLanguage = { language: string; extensions: string[]; count: number };

type LinguistEntry = { extensions?: readonly string[]; type?: string; filenames?: readonly string[] };

function languageByExtension(): Map<string, string> {
    const map = new Map<string, string>();
    for (const [name, entry] of Object.entries(linguistLanguages as unknown as Record<string, LinguistEntry>)) {
        if (entry.type !== 'programming') continue;
        for (const ext of entry.extensions ?? []) if (!map.has(ext.toLowerCase())) map.set(ext.toLowerCase(), name);
    }
    return map;
}

/** Proposes presets from the tree, the manifests and the dependencies, with the evidence for each. */
export function detectPresets(
    files: TrackedFile[],
    manifests: Map<string, Manifest>,
    facts: ManifestFacts[],
    scope = '',
): Proposal[] {
    const scoped = files.filter((file) => scope === '' || file.path.startsWith(`${scope}/`));
    const extensionCounts = new Map<string, number>();
    const names = new Set<string>();
    const shebangs = new Set<string>();
    for (const file of scoped) {
        const ext = extensionOf(file.path);
        if (ext !== '') extensionCounts.set(ext, (extensionCounts.get(ext) ?? 0) + 1);
        names.add(baseName(file.path));
        for (const tag of file.tags) if (tag.startsWith('shebang:')) shebangs.add(tag.slice(8));
    }
    const dependencies = new Map<string, string>();
    for (const fact of facts) {
        if (scope !== '' && !fact.path.startsWith(`${scope}/`) && fact.path !== `${scope}/package.json`) continue;
        for (const name of Object.keys(fact.dependencies)) dependencies.set(name, fact.path);
    }
    const proposals: Proposal[] = [];
    for (const manifest of manifests.values()) {
        const { detect, preset } = manifest;
        const extensions = detect.extensions.filter((ext) => extensionCounts.has(ext));
        if (extensions.length > 0) {
            const count = extensions.reduce((sum, ext) => sum + (extensionCounts.get(ext) ?? 0), 0);
            proposals.push({
                preset: preset.id,
                kind: preset.kind,
                evidence: `${count} ${extensions.join(', ')} file${count === 1 ? '' : 's'}`,
                count,
            });
            continue;
        }
        const filename = detect.filenames.find((name) =>
            /[*?{]/.test(name)
                ? scoped.some((file) => pathMatcher([name])(baseName(file.path)) || pathMatcher([name])(file.path))
                : names.has(name),
        );
        if (filename !== undefined) {
            const found = scoped.find(
                (file) =>
                    baseName(file.path) === filename ||
                    pathMatcher([filename])(file.path) ||
                    pathMatcher([filename])(baseName(file.path)),
            );
            proposals.push({ preset: preset.id, kind: preset.kind, evidence: found?.path ?? filename });
            continue;
        }
        const dependency = detect.dependencies.find((name) => dependencies.has(name));
        if (dependency !== undefined) {
            proposals.push({
                preset: preset.id,
                kind: preset.kind,
                evidence: `${dependency} in ${dependencies.get(dependency)}`,
            });
            continue;
        }
        const shebang = detect.shebangs.find((name) => shebangs.has(name));
        if (shebang !== undefined) {
            proposals.push({ preset: preset.id, kind: preset.kind, evidence: `${shebang} shebang` });
            continue;
        }
        if (detect.paths.length > 0) {
            const matcher = pathMatcher(detect.paths);
            const found = scoped.find((file) => matcher(file.path));
            if (found) {
                proposals.push({ preset: preset.id, kind: preset.kind, evidence: found.path });
                continue;
            }
        }
        if (preset.default && scope === '')
            proposals.push({ preset: preset.id, kind: preset.kind, evidence: 'every repository' });
    }
    return proposals;
}

/** Languages in the tree that no preset detects, named through GitHub Linguist's data. */
export function unknownLanguages(files: TrackedFile[], manifests: Map<string, Manifest>): UnknownLanguage[] {
    const known = new Set<string>();
    for (const manifest of manifests.values())
        for (const ext of [...manifest.detect.extensions, ...manifest.claims.extensions]) known.add(ext);
    const byExtension = languageByExtension();
    const counts = new Map<string, { extensions: Set<string>; count: number }>();
    for (const file of files) {
        if (file.nature !== 'source') continue;
        const ext = extensionOf(file.path);
        if (ext === '' || known.has(ext)) continue;
        const language = byExtension.get(ext);
        if (!language) continue;
        const entry = counts.get(language) ?? { extensions: new Set<string>(), count: 0 };
        entry.extensions.add(ext);
        entry.count += 1;
        counts.set(language, entry);
    }
    return [...counts.entries()]
        .map(([language, entry]) => ({ language, extensions: [...entry.extensions].sort(), count: entry.count }))
        .sort((a, b) => b.count - a.count);
}

/** The interpreter a shebang names, or undefined. */
export function shebangInterpreter(firstLine: string): string | undefined {
    const match = firstLine.match(/^#!\s*(?:\/usr\/bin\/env\s+(?:-S\s+)?)?(?:[\w./-]*\/)?([A-Za-z0-9_.-]+)/);
    if (!match) return undefined;
    const name = match[1]!.replace(/\d+(\.\d+)*$/, (digits) => (match[1] === `python${digits}` ? digits : ''));
    return SHEBANG_INTERPRETERS[match[1]!] ?? SHEBANG_INTERPRETERS[name];
}
