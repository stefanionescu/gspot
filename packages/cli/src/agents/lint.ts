import { globby } from 'globby';
import { fileURLToPath } from 'node:url';
import { guideSections } from '#cli/agents/sections.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { ESLINT_RULE_LEVELS } from '#cli/config/checks/eslint-levels.ts';
import { layerOfPath, frontMatterFindings } from '#cli/agents/metadata.ts';
import type { RuleText, RuleFinding, RulesLintReport } from '#cli/types/agents.ts';

import {
    EM_DASH,
    ITEM_END,
    LIST_ITEM,
    RULE_LINK,
    RULE_LAYERS,
    BOUNDARY_TERMS,
    BOUNDARY_LAYERS,
    FENCE_LANGUAGES,
    CORRUPTION_TERMS,
    INLINE_CODE_SPANS,
    INDEPENDENCE_TERMS,
    RULE_FILE_LINE_CEILING,
} from '#cli/config/agents.ts';

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
    if (!boundaryLayers.has(layer)) return [];
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
        message: `names gspot or claims enforcement: '${term.source}'; a guide states the rule and nothing else`,
    }));
}

function proseLineFindings(file: string, line: string, number: number, layer: string): RuleFinding[] {
    const residue = CORRUPTION_TERMS.filter((term) => term.test(line)).map((term) => ({
        file,
        line: number,
        message: `corruption residue: ${term.source}`,
    }));
    const link = RULE_LINK.test(line) ? [{ file, line: number, message: 'link to another guide' }] : [];
    const dash = line.includes(EM_DASH) ? [{ file, line: number, message: 'em dash' }] : [];
    return [
        ...residue,
        ...link,
        ...dash,
        ...boundaryFindings(file, line, number, layer),
        ...independenceFindings(file, line, number, layer),
    ];
}

// A list item that stops at a comma, at the conjunction, or without a full stop is a cut sentence. A parent that ends with a
// colon and continues in a nested list is whole (K-229).
function cutItemFinding(file: string, item: { line: number; last: string; nested: boolean }): RuleFinding | undefined {
    const last = item.last.trim();
    if (last === '' || (last.endsWith(':') && item.nested)) return undefined;
    if (last.endsWith(',')) return { file, line: item.line, message: 'list item ends with a comma' };
    if (/\band$/u.test(last)) return { file, line: item.line, message: 'list item ends with "and"' };
    if (!ITEM_END.test(last)) return { file, line: item.line, message: 'list item ends without a full stop' };
    return undefined;
}

function listItemFindings(file: string, lines: { number: number; text: string }[]): RuleFinding[] {
    if (file.startsWith('templates/')) return [];
    let item: { line: number; indent: number; last: string; nested: boolean } | undefined;
    const close = (): RuleFinding[] => {
        const finding = item === undefined ? undefined : cutItemFinding(file, item);
        item = undefined;
        return finding === undefined ? [] : [finding];
    };
    const findings = lines.flatMap(({ number, text: line }) => {
        const match = LIST_ITEM.exec(line);
        if (match !== null) {
            const indent = match[0].length - match[0].trimStart().length;
            if (item !== undefined && indent > item.indent) item.nested = true;
            const previous = close();
            item = { line: number, indent, last: line, nested: false };
            return previous;
        }
        if (item === undefined) return [];
        if (line.trim() === '' || line.startsWith('#')) return close();
        item.last = line;
        return [];
    });
    return [...findings, ...close()];
}

function ruleLines(
    file: string,
    source: string[],
): { lines: { number: number; text: string }[]; fences: RuleFinding[] } {
    const fences: RuleFinding[] = [];
    let open: { ticks: string; line: number } | undefined;
    const lines = source.flatMap((text, index) => {
        const number = index + 1;
        if (open !== undefined) {
            if (text.trim() === open.ticks) open = undefined;
            return [];
        }
        const opening = fenceOpening(text);
        if (opening === undefined) return [{ number, text }];
        open = { ticks: opening.ticks, line: number };
        const finding = fenceFinding(file, number, opening.language);
        if (finding !== undefined) fences.push(finding);
        return [{ number, text: '' }];
    });
    if (open !== undefined) fences.push({ file, line: open.line, message: 'unclosed fenced block' });
    return { lines, fences };
}

function levelFindings(file: RuleText, lines: { number: number; text: string }[]): RuleFinding[] {
    const sections = guideSections(file.text).filter((section) => section.all);
    const source = file.text.split('\n');
    return lines.flatMap(({ number, text }) => {
        const offset = source.slice(0, number - 1).reduce((length, line) => length + line.length + 1, 0);
        if (sections.some((section) => offset >= section.start && offset < section.end)) return [];
        return [...text.matchAll(INLINE_CODE_SPANS)].flatMap((match) => {
            const name = match[0].slice(1, -1);
            if (ESLINT_RULE_LEVELS[name] !== 'all') return [];
            return [{ file: file.path, line: number, message: `rule '${name}' requires an all-level section` }];
        });
    });
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

if (import.meta.main) {
    const rulesFolder = fileURLToPath(new URL('../../guides/', import.meta.url));
    const paths = await globby(['**/*.md'], { cwd: rulesFolder });
    const files = paths
        .filter((path) => isRulePath(path))
        .toSorted((a, b) => a.localeCompare(b))
        .map((path) => ({ path, text: readSource(rulesFolder, path).toString('utf8') }));
    const report = lintRules(files);
    for (const finding of report.findings)
        process.stdout.write(`rules/${finding.file}:${String(finding.line)}: ${finding.message}\n`);
    process.exitCode = report.findings.length > 0 ? 1 : 0;
}

/**
 * True when a path under rules/ is a guide: Markdown in a known layer folder.
 * @param path the path relative to rules/
 * @returns whether the lint reads it
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: True when a path under rules/ is a guide: Markdown in a known layer folder. 1 files make 3 calls; one owner keeps that behavior in one place.
export function isRulePath(path: string): boolean {
    const top = path.split('/', 1)[0] ?? '';
    return path.endsWith('.md') && (top === 'general' || top === 'templates' || layerNames.has(top));
}

/**
 * Lints the structure and content of the guides.
 * @param files the guides
 * @returns the findings and file count
 */
export function lintRules(files: RuleText[]): RulesLintReport {
    const findings = files.flatMap((file) => {
        const lines = file.text.split('\n');
        const scanned = ruleLines(file.path, lines);
        const layer = file.path.startsWith('templates/') ? 'template' : layerOfPath(file.path);
        return [
            ...frontMatterFindings(file.path, file.text),
            ...sizeFindings(file.path, lines),
            ...scanned.fences,
            ...levelFindings(file, scanned.lines),
            ...scanned.lines.flatMap(({ number, text }) => proseLineFindings(file.path, text, number, layer)),
            ...listItemFindings(file.path, scanned.lines),
        ];
    });
    return { findings, files: files.length };
}
