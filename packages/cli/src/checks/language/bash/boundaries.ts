import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import type { Engine, EngineInput } from '#cli/types/execution/check.ts';
import type { ScriptFile, ScriptIndex, SourceAnnotations } from '#cli/types/checks/language/bash.ts';

import {
    BOUNDARY_HEADER,
    SOURCE_STATEMENT,
    SOURCE_ANNOTATION,
    BOUNDARY_MIN_WORDS,
    BOUNDARY_HEADER_WINDOW,
} from '#cli/config/checks/language/bash.ts';

function sourcedPath(owner: string, annotation: string): string {
    if (annotation.startsWith('/')) return annotation.slice(1);
    const directory = posix.dirname(owner);
    return posix.normalize(posix.join(directory, annotation));
}

function annotatedSources(file: ScriptFile, input: EngineInput): SourceAnnotations {
    const sources = new Set<string>();
    const findings = file.lines.flatMap((line, position) => {
        if (!SOURCE_STATEMENT.test(line.trim())) return [];
        const annotation = SOURCE_ANNOTATION.exec((file.lines[position - 1] ?? '').trim())?.groups?.['path'];
        if (annotation === undefined)
            return [
                findingAt(
                    input,
                    { file: file.path, line: position + 1 },
                    'source-annotation',
                    'A source statement carries "# shellcheck source=<path>" on the line above it.',
                ),
            ];
        if (annotation !== '/dev/null') sources.add(sourcedPath(file.path, annotation));
        return [];
    });
    return { sources, findings };
}

function dependencyFindings(file: ScriptFile, sources: Set<string>, index: ScriptIndex, input: EngineInput): Finding[] {
    return file.references
        .entries()
        .flatMap(([name, lines]) => {
            const owner = index.owners.get(name);
            if (owner === undefined || owner === file.path || sources.has(owner)) return [];
            return [
                findingAt(
                    input,
                    { file: file.path, line: lines[0] ?? 1 },
                    'implicit-dependency',
                    `${name} lives in ${owner}, which this script does not source directly.`,
                ),
            ];
        })
        .toArray();
}

/**
 * The boundary findings for scripts under [bash] boundary_roots: the header, source annotations, barrels, and implicit dependencies.
 * @param input the check context
 * @returns the findings
 */
export const bashBoundaries: Engine = async (input) => {
    const roots = input.view.settings['bash.boundary_roots'] as string[];
    if (roots.length === 0) return [];
    const isGoverned = pathMatcher(roots.map((root) => (root.includes('*') ? root : `${root.replace(/\/$/u, '')}/**`)));
    const index = await getScriptIndex(input);
    return index.files
        .filter((file) => isGoverned(file.path))
        .flatMap((file) => {
            const hasBoundary = file.lines.slice(0, BOUNDARY_HEADER_WINDOW).some((line) => {
                const description = BOUNDARY_HEADER.exec(line)?.groups?.['description'];
                return description !== undefined && description.split(/\s+/u).length >= BOUNDARY_MIN_WORDS;
            });
            const findings = hasBoundary
                ? []
                : [
                      findingAt(
                          input,
                          { file: file.path, line: 1 },
                          'boundary-header',
                          `A script under an architecture root opens with "# Boundary: <at least ${String(BOUNDARY_MIN_WORDS)} words>".`,
                      ),
                  ];
            const { sources, findings: sourceFindings } = annotatedSources(file, input);
            if (!file.isExecutable && sources.size > 0 && file.functions.length === 0)
                findings.push(
                    findingAt(
                        input,
                        { file: file.path, line: 1 },
                        'source-barrel',
                        'This library only sources other files. Source them where they are used, and delete this file.',
                    ),
                );
            return [...findings, ...sourceFindings, ...dependencyFindings(file, sources, index, input)];
        });
};
