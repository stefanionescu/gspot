// Lints the rule files: front matter, links, size, layer boundary, fences, corruption.
import { frontMatterFindings, layerOfPath } from '#cli/rules/front-matter.ts';
import type { RuleText, RuleFinding, RulesLintReport, FenceWalk } from '#types/rules.ts';

import {
    BOUNDARY_LAYERS,
    BOUNDARY_TERMS,
    RULE_LAYERS,
    CORRUPTION_TERMS,
    INDEPENDENCE_TERMS,
    FENCE_LANGUAGES,
    RULE_FILE_LINE_CEILING,
} from '#cli/rules/terms.ts';

const RULE_LINK =
    /\]\((?:\.\.\/)*(?:general|language|runtime|framework|library|tool|platform|database|shared|repository)\/[^)]+\.md\)/u;
const INLINE_CODE = /`[^`]*`/u;
const INLINE_CODE_SPANS = /`[^`]*`/gu;
const EM_DASH = '—';
const layerNames = new Set(RULE_LAYERS);
const fenceLanguages = new Set(FENCE_LANGUAGES);
const boundaryLayers = new Set(BOUNDARY_LAYERS);

function isTemplate(path: string): boolean {
    return path.startsWith('templates/');
}

function fenceOpening(line: string): { ticks: string; language: string } | undefined {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('```')) return undefined;
    let count = 0;
    while (trimmed[count] === '`') count += 1;
    return { ticks: trimmed.slice(0, count), language: trimmed.slice(count).trim().split(/\s/u, 1)[0] ?? '' };
}

function fenceFinding(file: string, line: number, language: string): RuleFinding | undefined {
    if (language === '') return { file, line, message: 'fenced block without a language tag' };
    if (!fenceLanguages.has(language))
        return { file, line, message: `fence language '${language}' is not in the allowed set` };
    return undefined;
}

function boundaryFindings(file: string, line: string, number: number, layer: string): RuleFinding[] {
    if (!boundaryLayers.has(layer) || INLINE_CODE.test(line)) return [];
    return BOUNDARY_TERMS.filter((term) => term.test(line)).map((term) => ({
        file,
        line: number,
        message: `layer boundary: '${term.source}' in a ${layer} file`,
    }));
}

// A template is copied into a project and may say where it came from; every other file stands without gspot.
function independenceFindings(file: string, line: string, number: number, layer: string): RuleFinding[] {
    if (layer === 'template') return [];
    const prose = line.replaceAll(INLINE_CODE_SPANS, '');
    return INDEPENDENCE_TERMS.filter((term) => term.test(prose)).map((term) => ({
        file,
        line: number,
        message: `names gspot or claims enforcement: '${term.source}'; a rule file states the rule and nothing else`,
    }));
}

function proseLineFindings(file: string, line: string, number: number, layer: string): RuleFinding[] {
    const residue = CORRUPTION_TERMS.filter((term) => term.test(line)).map((term) => ({
        file,
        line: number,
        message: `corruption residue: ${term.source}`,
    }));
    const link = RULE_LINK.test(line) ? [{ file, line: number, message: 'link to another rule file' }] : [];
    const dash = line.includes(EM_DASH) ? [{ file, line: number, message: 'em dash' }] : [];
    return [
        ...residue,
        ...link,
        ...dash,
        ...boundaryFindings(file, line, number, layer),
        ...independenceFindings(file, line, number, layer),
    ];
}

function fenceStep(walk: FenceWalk, line: string, number: number): void {
    if (walk.open !== undefined) {
        if (line.trim() === walk.open.ticks) walk.open = undefined;
        return;
    }
    const opening = fenceOpening(line);
    if (opening === undefined) {
        walk.onProse(line, number);
        return;
    }
    walk.open = { ticks: opening.ticks, line: number };
    const finding = fenceFinding(walk.file, number, opening.language);
    if (finding !== undefined) walk.findings.push(finding);
}

function fenceWalk(file: string, lines: string[], onProse: (line: string, number: number) => void): RuleFinding[] {
    const walk: FenceWalk = { file, findings: [], open: undefined, onProse };
    for (const [index, line] of lines.entries()) fenceStep(walk, line, index + 1);
    if (walk.open !== undefined) walk.findings.push({ file, line: walk.open.line, message: 'unclosed fenced block' });
    return walk.findings;
}

function lineFindings(file: string, lines: string[]): RuleFinding[] {
    const layer = isTemplate(file) ? 'template' : layerOfPath(file);
    const prose: RuleFinding[] = [];
    const fences = fenceWalk(file, lines, (line, number) => {
        prose.push(...proseLineFindings(file, line, number, layer));
    });
    return [...fences, ...prose];
}

function sizeFindings(file: string, lines: string[]): RuleFinding[] {
    if (isTemplate(file) || lines.length <= RULE_FILE_LINE_CEILING) return [];
    return [
        {
            file,
            line: lines.length,
            message: `${String(lines.length)} lines exceeds the ${String(RULE_FILE_LINE_CEILING)}-line ceiling`,
        },
    ];
}

function fileReport(file: RuleText): RuleFinding[] {
    const lines = file.text.split('\n');
    return [
        ...frontMatterFindings(file.path, file.text),
        ...sizeFindings(file.path, lines),
        ...lineFindings(file.path, lines),
    ];
}

/**
 * True when a path under rules/ is a rule file: Markdown in a known layer folder.
 * @param path the path relative to rules/
 * @returns whether the lint reads it
 */
export function isRulePath(path: string): boolean {
    const top = path.split('/', 1)[0] ?? '';
    return path.endsWith('.md') && (top === 'general' || top === 'templates' || layerNames.has(top));
}

/**
 * Lints the structure and content of the rule files.
 * @param files the rule files
 * @returns the findings and file count
 */
export function lintRules(files: RuleText[]): RulesLintReport {
    return { findings: files.flatMap((file) => fileReport(file)), files: files.length };
}
