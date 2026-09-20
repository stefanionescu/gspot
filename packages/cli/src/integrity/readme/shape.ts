// The shape of a README: one H1, an opening paragraph, a Contents list when it is long, a section on getting started, no banned heading.
import { join } from 'node:path';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import type { ShapeProblem } from '#types/integrity.ts';
import { CONTENTS_HEADING, CONTENTS_THRESHOLD, START_SECTION_WORDS } from '#config/docs.ts';

const TITLE = /^# /u;
const SECTION = /^## (?<text>.+)$/u;
const ANY_HEADING = /^#{1,6} /u;
const FENCE = /^\s*(?<ticks>`{3,})/u;

function outsideFences(lines: string[]): string[] {
    let fence: string | undefined;
    return lines.map((line) => {
        const opening = FENCE.exec(line)?.groups?.['ticks'];
        if (fence === undefined && opening !== undefined) fence = opening;
        else if (fence !== undefined && line.trim() === fence) fence = undefined;
        else if (fence === undefined) return line;
        return '';
    });
}

function titleProblem(lines: string[]): ShapeProblem[] {
    const titleLines = lines.map((line, index) => (TITLE.test(line) ? index + 1 : -1)).filter((line) => line !== -1);
    return titleLines.length === 1 ? [] : [[titleLines[0] ?? 1, 'one-h1', 'A README has exactly one H1.']];
}

function openingProblem(lines: string[]): ShapeProblem[] {
    const firstTitle = lines.findIndex((line) => TITLE.test(line));
    const start = firstTitle === -1 ? 0 : firstTitle;
    const firstSection = lines.findIndex((line, index) => index >= start && SECTION.test(line));
    const between = lines
        .slice(start, firstSection === -1 ? lines.length : firstSection)
        .filter((line) => line.trim() !== '' && !ANY_HEADING.test(line));
    return between.length === 0
        ? [[start + 1, 'opening-paragraph', 'A README opens with a paragraph before its first H2.']]
        : [];
}

function sectionProblems(lines: string[], threshold: number, isScopeRoot: boolean): ShapeProblem[] {
    const sections = lines
        .map((line) => SECTION.exec(line)?.groups?.['text']?.trim().toLowerCase())
        .filter((text): text is string => text !== undefined);
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
    const lines = outsideFences(text.split('\n'));
    return [...titleProblem(lines), ...openingProblem(lines), ...sectionProblems(lines, threshold, isScopeRoot)];
}

// The root README and every scope's README tell the reader how to start; a folder README only explains its folder.
function scopeRoots(input: EngineInput): Set<string> {
    return new Set(['README.md', ...input.session.repository.scopes.map((scope) => `${scope.path}/README.md`)]);
}

/**
 * The shape findings for every README in the check's files.
 * @param input the engine input
 * @returns the findings
 */
export function readmeShape(input: EngineInput): Promise<Finding[]> {
    const docs = input.view.tool('docs');
    if (docs['readme_shape'] === false) return Promise.resolve([]);
    const threshold = typeof docs['contents_threshold'] === 'number' ? docs['contents_threshold'] : CONTENTS_THRESHOLD;
    const roots = scopeRoots(input);
    const findings = input.files
        .filter(
            (file) =>
                (file.path === 'README.md' || file.path.endsWith('/README.md')) &&
                existsSync(join(input.root, file.path)),
        )
        .flatMap((file) =>
            shapeProblems(readFileSync(join(input.root, file.path), 'utf8'), threshold, roots.has(file.path)).map(
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
    return Promise.resolve(findings);
}
