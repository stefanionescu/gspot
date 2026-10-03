import { join } from 'node:path';
import { statSync } from 'node:fs';
import type { RootContent } from 'mdast';
import { toString } from 'mdast-util-to-string';
import { findingAt } from '#cli/execution/finding.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { readSource } from '#cli/repository/sources.ts';
import type { ShapeProblem } from '#cli/types/checks/general/docs.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { START_WORDS, LICENSE_NAMES, CONTENTS_HEADING, CONTENTS_HEADINGS } from '#cli/config/checks/general/docs.ts';

// A README section is a second-level heading.
const SECTION_DEPTH = 2;

function openingProblem(nodes: RootContent[]): ShapeProblem[] {
    const title = nodes.findIndex((node) => node.type === 'heading' && node.depth === 1);
    const start = title === -1 ? 0 : title;
    const section = nodes.findIndex(
        (node, index) => index >= start && node.type === 'heading' && node.depth === SECTION_DEPTH,
    );
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
        .filter((node) => node.type === 'heading' && node.depth === SECTION_DEPTH)
        .map((node) => toString(node).trim().toLowerCase());
    const problems: ShapeProblem[] = [];
    if (sections.length > threshold && !sections.includes(CONTENTS_HEADING))
        problems.push([
            1,
            'contents',
            `A README with more than ${String(threshold)} H2 headings carries a Contents list.`,
        ]);
    if (isScopeRoot && sections.every((text) => START_WORDS.every((word) => !text.includes(word))))
        problems.push([1, 'start-section', `A README has a section whose heading says ${START_WORDS.join(', ')}.`]);
    return problems;
}

/**
 * One finding per scope without a README.md, and one when the root has no license file.
 * @param input the engine input
 * @returns the findings
 */
export function readmePresent(input: EngineInput): Finding[] {
    const isLicenseRequired = input.view.tool('docs')['license'] !== false;
    const findings: Finding[] = [];
    const readme = input.scope === '' ? 'README.md' : `${input.scope}/README.md`;
    if (statSync(join(input.root, readme), { throwIfNoEntry: false }) === undefined)
        findings.push(
            findingAt(
                input,
                { file: readme },
                'missing-readme',
                `The scope ${input.scope === '' ? 'root' : input.scope} has no README.md.`,
            ),
        );
    if (
        isLicenseRequired &&
        input.scope === '' &&
        LICENSE_NAMES.every((name) => statSync(join(input.root, name), { throwIfNoEntry: false }) === undefined)
    )
        findings.push(findingAt(input, { file: 'LICENSE' }, 'missing-license', 'The root has no LICENSE file.'));
    return findings;
}

/**
 * The shape findings for every README in the check's files.
 * @param input the engine input
 * @returns the findings
 */
export function readmeShape(input: EngineInput): Finding[] {
    const headings = input.view.settings['limits.docs.contents_headings'];
    const threshold = typeof headings === 'number' ? headings : CONTENTS_HEADINGS;
    const roots = new Set(['README.md', ...input.scopeEntries.map((scope) => `${scope.path}/README.md`)]);
    return input.files
        .filter(
            (file) =>
                (file.path === 'README.md' || file.path.endsWith('/README.md')) &&
                statSync(join(input.root, file.path), { throwIfNoEntry: false }) !== undefined,
        )
        .flatMap((file) => {
            const nodes = fromMarkdown(readSource(input.root, file.path, input.reads).toString('utf8')).children;
            const titles = nodes.filter((node) => node.type === 'heading' && node.depth === 1);
            const problems: ShapeProblem[] =
                titles.length === 1
                    ? []
                    : [[titles[0]?.position?.start.line ?? 1, 'one-h1', 'A README has exactly one H1.']];
            problems.push(...openingProblem(nodes), ...sectionProblems(nodes, threshold, roots.has(file.path)));
            return problems.map(([line, rule, text]) => findingAt(input, { file: file.path, line }, rule, text));
        });
}
