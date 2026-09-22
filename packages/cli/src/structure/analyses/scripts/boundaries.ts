// Scripts under the architecture roots declare their boundary and their sources. Searched: shellcheck source=; it resolves, it does not require.
import { posix } from 'node:path';
import type { Finding } from '#cli/output/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import type { Analysis, ScriptFile, ScriptIndex, StructureContext } from '#cli/structure/types.ts';

import {
    BOUNDARY_HEADER,
    BOUNDARY_HEADER_WINDOW,
    BOUNDARY_MIN_WORDS,
    SOURCE_ANNOTATION,
    SOURCE_STATEMENT,
} from '#cli/structure/structure-definitions.ts';

function hasBoundary(file: ScriptFile): boolean {
    return file.lines.slice(0, BOUNDARY_HEADER_WINDOW).some((line) => {
        const description = BOUNDARY_HEADER.exec(line)?.groups?.['description'];
        return description !== undefined && description.split(/\s+/u).length >= BOUNDARY_MIN_WORDS;
    });
}

function resolvedSource(owner: string, annotation: string): string {
    if (annotation.startsWith('/')) return annotation.slice(1);
    const directory = posix.dirname(owner);
    return posix.normalize(posix.join(directory, annotation));
}

function annotatedSources(file: ScriptFile, context: StructureContext): { sources: Set<string>; findings: Finding[] } {
    const sources = new Set<string>();
    const findings = file.lines.flatMap((line, position) => {
        if (!SOURCE_STATEMENT.test(line.trim())) return [];
        const annotation = SOURCE_ANNOTATION.exec((file.lines[position - 1] ?? '').trim())?.groups?.['path'];
        if (annotation === undefined)
            return [
                context.report(
                    file.path,
                    position + 1,
                    'source-annotation',
                    'A source statement carries "# shellcheck source=<path>" on the line above it.',
                ),
            ];
        if (annotation !== '/dev/null') sources.add(resolvedSource(file.path, annotation));
        return [];
    });
    return { sources, findings };
}

function dependencyFindings(
    file: ScriptFile,
    sources: Set<string>,
    index: ScriptIndex,
    context: StructureContext,
): Finding[] {
    return file.references
        .entries()
        .flatMap(([name, lines]) => {
            const owner = index.owners.get(name);
            if (owner === undefined || owner === file.path || sources.has(owner)) return [];
            return [
                context.report(
                    file.path,
                    lines[0] ?? 1,
                    'implicit-dependency',
                    `${name} lives in ${owner}, which this script does not source directly.`,
                ),
            ];
        })
        .toArray();
}

/**
 * The boundary findings for scripts under [tools.bash] architecture_roots: the header, source annotations, barrels and implicit dependencies.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptBoundaries: Analysis = async (context, scripts) => {
    const roots = context.bashList('architecture_roots');
    if (roots.length === 0) return [];
    const isGoverned = pathMatcher(roots.map((root) => (root.includes('*') ? root : `${root.replace(/\/$/u, '')}/**`)));
    const index = await scripts();
    return index.files
        .filter((file) => isGoverned(file.path))
        .flatMap((file) => {
            const findings = hasBoundary(file)
                ? []
                : [
                      context.report(
                          file.path,
                          1,
                          'boundary-header',
                          `A script under an architecture root opens with "# Boundary: <at least ${String(BOUNDARY_MIN_WORDS)} words>".`,
                      ),
                  ];
            const { sources, findings: sourceFindings } = annotatedSources(file, context);
            if (!file.isExecutable && sources.size > 0 && file.functions.length === 0)
                findings.push(
                    context.report(
                        file.path,
                        1,
                        'source-barrel',
                        'A sourced library owns behavior; this one only sources other files.',
                    ),
                );
            return [...findings, ...sourceFindings, ...dependencyFindings(file, sources, index, context)];
        });
};
