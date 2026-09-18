// Lints the rule corpus: front matter, links, size, layer boundary, fences, corruption, and Vale when it is installed.
import { runBlocking } from '#cli/platform/spawn.ts';
import { frontMatterFindings, layerOfPath } from '#rules-lint/front-matter.ts';
import type { RuleText, RuleFinding, RulesLintOptions, RulesLintReport, FenceWalk } from '#types/rules.ts';

import {
    BOUNDARY_LAYERS,
    BOUNDARY_TERMS,
    RULE_LAYERS,
    CORRUPTION_TERMS,
    FENCE_LANGUAGES,
    RULE_FILE_LINE_CEILING,
} from '#rules-lint/terms.ts';

const RULE_LINK =
    /\]\((?:\.\.\/)*(?:general|language|runtime|framework|library|tool|platform|database|shared|repository)\/[^)]+\.md\)/u;
const INLINE_CODE = /`[^`]*`/u;
const EM_DASH = '—';
const VALE_FIELDS = 4;
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

function proseLineFindings(file: string, line: string, number: number, layer: string): RuleFinding[] {
    const residue = CORRUPTION_TERMS.filter((term) => term.test(line)).map((term) => ({
        file,
        line: number,
        message: `corruption residue: ${term.source}`,
    }));
    const link = RULE_LINK.test(line) ? [{ file, line: number, message: 'link to another rule file' }] : [];
    const dash = line.includes(EM_DASH) ? [{ file, line: number, message: 'em dash' }] : [];
    return [...residue, ...link, ...dash, ...boundaryFindings(file, line, number, layer)];
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

function fileReport(file: RuleText, options: RulesLintOptions): RuleFinding[] {
    const lines = file.text.split('\n');
    return [
        ...frontMatterFindings(file.path, file.text),
        ...sizeFindings(file.path, lines),
        ...lineFindings(file.path, lines),
    ];
}

function valeLine(file: string, line: string): RuleFinding | undefined {
    const [, number = '', column = '', ...rest] = line.split(':', VALE_FIELDS + 1);
    if (rest.length === 0) return undefined;
    return { file, line: Number(number), message: `${rest.join(':').trim()} (column ${column})` };
}

function valeFindings(files: RuleText[], vale: { binary: string; config: string }, root: string): RuleFinding[] {
    return files.flatMap((file) => {
        const result = runBlocking([vale.binary, '--config', vale.config, '--ext', '.md', '--output', 'line'], {
            cwd: root,
            stdin: file.text,
        });
        return result.stdout
            .split('\n')
            .filter((line) => line !== '')
            .map((line) => valeLine(file.path, line))
            .filter((finding) => finding !== undefined);
    });
}

/**
 * True when a path under rules/ is a corpus file: Markdown in a known layer folder.
 * @param path the path relative to rules/
 * @returns whether the lint reads it
 */
export function isRulePath(path: string): boolean {
    const top = path.split('/', 1)[0] ?? '';
    return path.endsWith('.md') && (top === 'general' || top === 'templates' || layerNames.has(top));
}

/**
 * Lints the corpus files. Vale runs when its binary and config are given.
 * @param files the corpus files
 * @param options the known check ids and preset ids, and the Vale binary and config
 * @param root the directory Vale runs in
 * @returns the findings, the file count, and whether Vale ran
 */
export function lintRules(files: RuleText[], options: RulesLintOptions, root = process.cwd()): RulesLintReport {
    const own = files.flatMap((file) => fileReport(file, options));
    const vale = options.vale === undefined ? undefined : valeFindings(files, options.vale, root);
    return { findings: [...own, ...(vale ?? [])], files: files.length, isValeRun: vale !== undefined };
}
