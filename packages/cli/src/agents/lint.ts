import { globby } from 'globby';
import { fileURLToPath } from 'node:url';
import { readSource } from '#cli/repository/tracked.ts';
import { frontMatterFindings, layerOfPath } from '#cli/agents/metadata.ts';

import {
    BOUNDARY_LAYERS,
    BOUNDARY_TERMS,
    RULE_LAYERS,
    CORRUPTION_TERMS,
    INDEPENDENCE_TERMS,
    FENCE_LANGUAGES,
    RULE_FILE_LINE_CEILING,
} from '#cli/agents/terms.ts';

const RULE_LINK =
    /\]\((?:\.\.\/)*(?:general|language|runtime|framework|library|tool|platform|database|shared|repository)\/[^)]+\.md\)/u;
const INLINE_CODE = /`[^`]*`/u;
const INLINE_CODE_SPANS = /`[^`]*`/gu;
const EM_DASH = '—';
const layerNames = new Set(RULE_LAYERS);
const fenceLanguages = new Set(FENCE_LANGUAGES);
const boundaryLayers = new Set(BOUNDARY_LAYERS);

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

const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/u;
const ITEM_END = /[.!?]["')\]]*$/u;

// A list item that stops at a comma, at "and", or without a full stop is a cut sentence. A parent that ends with a
// colon and continues in a nested list is whole (K-229).
function cutItemFinding(file: string, item: { line: number; last: string; nested: boolean }): RuleFinding | undefined {
    const last = item.last.trim();
    if (last === '' || (last.endsWith(':') && item.nested)) return undefined;
    if (last.endsWith(',')) return { file, line: item.line, message: 'list item ends with a comma' };
    if (/\band$/u.test(last)) return { file, line: item.line, message: 'list item ends with "and"' };
    if (!ITEM_END.test(last)) return { file, line: item.line, message: 'list item ends without a full stop' };
    return undefined;
}

function listItemFindings(file: string, lines: string[]): RuleFinding[] {
    if (file.startsWith('templates/')) return [];
    const findings: RuleFinding[] = [];
    let item: { line: number; indent: number; last: string; nested: boolean } | undefined;
    let fence: string | undefined;
    const close = (): void => {
        const finding = item === undefined ? undefined : cutItemFinding(file, item);
        if (finding !== undefined) findings.push(finding);
        item = undefined;
    };
    for (const [index, line] of lines.entries()) {
        const opening = fenceOpening(line);
        if (fence !== undefined) {
            if (line.trim() === fence) fence = undefined;
            continue;
        }
        if (opening !== undefined) {
            fence = opening.ticks;
            close();
            continue;
        }
        const match = LIST_ITEM.exec(line);
        if (match !== null) {
            const indent = match[0].length - match[0].trimStart().length;
            if (item !== undefined && indent > item.indent) item.nested = true;
            close();
            item = { line: index + 1, indent, last: line, nested: false };
            continue;
        }
        if (item === undefined) continue;
        if (line.trim() === '' || line.startsWith('#')) close();
        else item.last = line;
    }
    close();
    return findings;
}

function lineFindings(file: string, lines: string[]): RuleFinding[] {
    const layer = file.startsWith('templates/') ? 'template' : layerOfPath(file);
    const prose: RuleFinding[] = [];
    const fences: RuleFinding[] = [];
    let open: { ticks: string; line: number } | undefined;
    for (const [index, line] of lines.entries()) {
        const number = index + 1;
        if (open !== undefined) {
            if (line.trim() === open.ticks) open = undefined;
            continue;
        }
        const opening = fenceOpening(line);
        if (opening === undefined) prose.push(...proseLineFindings(file, line, number, layer));
        else {
            open = { ticks: opening.ticks, line: number };
            const finding = fenceFinding(file, number, opening.language);
            if (finding !== undefined) fences.push(finding);
        }
    }
    if (open !== undefined) fences.push({ file, line: open.line, message: 'unclosed fenced block' });
    return [...fences, ...prose];
}

function sizeFindings(file: string, lines: string[]): RuleFinding[] {
    if (file.startsWith('templates/') || lines.length <= RULE_FILE_LINE_CEILING) return [];
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
        ...listItemFindings(file.path, lines),
    ];
}

if (import.meta.main) {
    const rulesFolder = fileURLToPath(new URL('../../rules/', import.meta.url));
    const paths = await globby(['**/*.md'], { cwd: rulesFolder });
    const files = paths
        .filter(isRulePath)
        .toSorted((a, b) => a.localeCompare(b))
        .map((path) => ({ path, text: readSource(rulesFolder, path).toString('utf8') }));
    const report = lintRules(files);
    for (const finding of report.findings)
        console.log(`rules/${finding.file}:${String(finding.line)}: ${finding.message}`);
    process.exitCode = report.findings.length > 0 ? 1 : 0;
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
    return { findings: files.flatMap(fileReport), files: files.length };
}

/** One thing the rule lint found: the file relative to rules/, the one-based line, and what is wrong. */
export type RuleFinding = { file: string; line: number; message: string };

/** A rule file by its path relative to rules/. */
export type RuleText = { path: string; text: string };

/** The rule lint's result. */
export type RulesLintReport = { findings: RuleFinding[]; files: number };
