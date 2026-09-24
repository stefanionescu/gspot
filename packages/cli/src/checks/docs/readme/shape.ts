import { readSource } from '#cli/repository/tracked.ts';
import { join } from 'node:path';
// The shape of a README: one H1, an opening paragraph, a Contents list when it is long, a section on getting started, no banned heading.
import type { RootContent } from 'mdast';
import { toString } from 'mdast-util-to-string';
import type { EngineInput } from '#cli/types/execution.ts';
import type { Finding } from '#cli/types/reports.ts';
import { existsSync } from 'node:fs';
import { fromMarkdown } from 'mdast-util-from-markdown';


type ShapeProblem = [number, string, string];

function titleProblem(nodes: RootContent[]): ShapeProblem[] {
    const titles = nodes.filter((node) => node.type === 'heading' && node.depth === 1);
    return titles.length === 1
        ? []
        : [[titles[0]?.position?.start.line ?? 1, 'one-h1', 'A README has exactly one H1.']];
}

function openingProblem(nodes: RootContent[]): ShapeProblem[] {
    const title = nodes.findIndex((node) => node.type === 'heading' && node.depth === 1);
    const start = title === -1 ? 0 : title;
    const section = nodes.findIndex((node, index) => index >= start && node.type === 'heading' && node.depth === 2);
    const opening = nodes.slice(start, section === -1 ? nodes.length : section);
    return opening.some((node) => node.type === 'paragraph')
        ? []
        : [
              [
                  nodes[start]?.position?.start.line ?? 1,
                  'opening-paragraph',
                  'A README opens with a paragraph before its first H2.',
              ],
          ];
}

function sectionProblems(nodes: RootContent[], threshold: number, isScopeRoot: boolean): ShapeProblem[] {
    const sections = nodes
        .filter((node) => node.type === 'heading' && node.depth === 2)
        .map((node) => toString(node).trim().toLowerCase());
    const problems: ShapeProblem[] = [];
    if (sections.length > threshold && !sections.includes(CONTENTS_HEADING))
        problems.push([
            1,
            'contents',
            `A README with more than ${String(threshold)} H2 headings carries a Contents list.`,
        ]);
    if (isScopeRoot && sections.every((text) => START_SECTION_WORDS.every((word) => !text.includes(word))))
        problems.push([
            1,
            'start-section',
            `A README has a section whose heading says ${START_SECTION_WORDS.join(', ')}.`,
        ]);
    return problems;
}

function shapeProblems(text: string, threshold: number, isScopeRoot: boolean): ShapeProblem[] {
    const nodes = fromMarkdown(text).children;
    return [...titleProblem(nodes), ...openingProblem(nodes), ...sectionProblems(nodes, threshold, isScopeRoot)];
}

// The root README and every scope's README tell the reader how to start; a folder README only explains its folder.
function scopeRoots(input: EngineInput): Set<string> {
    return new Set(['README.md', ...input.scopeEntries.map((scope) => `${scope.path}/README.md`)]);
}

/**
 * The shape findings for every README in the check's files.
 * @param input the engine input
 * @returns the findings
 */
export function readmeShape(input: EngineInput): Finding[] {
    const docs = input.view.tool('docs');
    if (docs['readme_shape'] === false) return [];
    const threshold = typeof docs['contents_threshold'] === 'number' ? docs['contents_threshold'] : CONTENTS_THRESHOLD;
    const roots = scopeRoots(input);
    const findings = input.files
        .filter(
            (file) =>
                (file.path === 'README.md' || file.path.endsWith('/README.md')) &&
                existsSync(join(input.root, file.path)),
        )
        .flatMap((file) =>
            shapeProblems(readSource(input.root, file.path).toString('utf8'), threshold, roots.has(file.path)).map(
                ([line, rule, text]) => ({
                    check: input.spec.name,
                    file: file.path,
                    line,
                    rule,
                    message: text,
                    fixable: false,
                }),
            ),
        );
    return findings;
}

const START_SECTION_WORDS = ['install', 'setup', 'start', 'requirements'];

const CONTENTS_THRESHOLD = 6;

const CONTENTS_HEADING = 'contents';
