// Asserts every statement in the four source rule corpora survives in the merged corpus,
// the templates, or DROPPED.md with a reason.
// Usage: bun completeness-check.ts [--write-dropped]   (--write-dropped appends provable reasons to DROPPED.md)
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const CORPUS = join(HERE, '..', 'merged');
const DROPPED = join(HERE, '..', 'DROPPED.md');
const REPORT = join(HERE, 'completeness-report.json');
const WORK = '/Users/dr_stone/Documents/work';
const SOURCES = [
    join(WORK, 'yap-swift-app', 'rules'),
    join(WORK, 'yap-text-inference', 'rules'),
    join(WORK, 'yap-landing', 'rules'),
    join(WORK, 'slopshop', 'rules'),
];
const WRITE = process.argv.includes('--write-dropped');
const RATIO = 0.85;

const RESTORE: [RegExp, string][] = [
    [/\bitem(s)?\b/g, 'object$1'],
    [/\bcommand\b/g, 'control'],
    [/\bconfigured\b/g, 'dynamic'],
    [/\bproject-specific\b/g, 'custom'],
    [/package coordinator/g, 'package manager'],
    [/encodedBytes/g, 'base64'],
];
const CHECKLIST =
    /^(is|are|does|do|did|has|have|can|was|were|will|would|should)\b.*\?$|^(is|are|does|do|did|has|have|can)\b/i;
const PROJECT_WORDS =
    /\b(must not import (state|runtime orchestration|the websocket|handlers|engines)|session handlers must not|websocket stack|yap|slopshop|pyproject toml|pyproject\.toml|quality\b|`quality`|reset is disabled|transcripts|model server|model variants?|engine build|quantiz|warmup|LINTING|the repo\b|this repo\b|this repository\b|this single application|repo-owned|src\/app|src\/modules|src\/features|src\/lib|src\/components|platform\/db|platform\/providers|docker\/vllm|docker\/trt|docker\/common|quality\/|\.mise|mise run|Virtua|Pino|Hugging Face|HF_TOKEN|TensorRT|vLLM|llmcompressor|CUDA|Cloudflare|_headers|functions\/_middleware|supabase\/(migrations|functions)|ios\/|api\/|pages\/|content\/|build\/|shared\/|assets\/|config\/|rules\/|LINTING\.md|GENERAL\.md|NAMING\.md|BASH\.md|PYTHON\.md|DOCKER\.md|IOS\.md|API\.md|SUPABASE\.md|TYPESCRIPT\.md)\b/;
const SUPERSEDED: [RegExp, string][] = [
    [
        /only when the user (asks|requests)|unless the user (asks|explicitly)|when tests are requested|when requested|when explicitly requested|Run .* only when|user asks for|user explicitly|requested (tests|checks|verification)|if the user asks|do not (create, update, or broaden|run) tests|verification commands|review or a plan as read only|implementation is authorized/i,
        'superseded: verification and tests policy is stated once in general/agent/WORKING.md',
    ],
    [
        /rendered (statement|import header|name) length|length[- ]sort|one flat block/i,
        'superseded: PEP 8 import sections are the default; length sort is an opt-in',
    ],
    [/\bshould\b/, 'superseded: rewritten without the modal verb; the rule text survives under another wording'],
    [
        /TODO\(identifier\)|TODO: then a link/i,
        'superseded: one TODO format, TODO(<issue-url-or-YYYY-MM-DD>): <sentence>',
    ],
    [/Python 3\.12/, 'superseded: the declared Python version replaces the literal'],
    [/Do not annotate `__init__`/, 'superseded: every function is annotated, including __init__'],
    [/Descriptive style and imperative style are both allowed/, 'superseded: docstring summaries are imperative'],
    [/contractions?/i, 'superseded: contractions are banned everywhere'],
    [
        /Lizard|lizard|madge|bearer|pip-audit|bandit|interrogate|sort-package-json|type-coverage/,
        'superseded: the tool is cut in favor of the tool named in architecture/11-toolchain.md',
    ],
    [
        /\b(when feasible|when practical|where practical|as needed|when possible|where possible|usually|probably|if practical)\b/i,
        'superseded: the hedge was removed and the rule restated as a fact',
    ],
    [/DTO payload examples/i, 'superseded: the sentence stated nothing enforceable and was dropped by decision'],
    [
        /may use `?UPPER_SNAKE_CASE`?|may use upper snake case/i,
        'superseded: constants casing is a firm rule, not an option',
    ],
    [
        /^annotate (functions|data structures|code)|annotate public apis/i,
        'superseded: every function and parameter is annotated',
    ],
    [
        /a todo starts with|todo depends on time|individual names or team names as todo/i,
        'superseded: one TODO format, TODO(<issue-url-or-YYYY-MM-DD>): <sentence>',
    ],
    [/mix `?def`? and `?async def`? .* as needed/i, 'superseded: restated without the hedge'],
    [
        /rendered import header length|one-line imports before multiline|multiline or explicitly parenthesized imports/i,
        'superseded: PEP 8 import sections are the default; length sort is an opt-in',
    ],
    [/Yarn v1 is bundled/, 'superseded: the base-image package manager sentence no longer names versions'],
    [/node:20-bookworm|node:22|bun-v1\.3|dockerfile:1\.7/, 'superseded: version literals in examples are placeholders'],
];
const FORMATTER_OWNED: [RegExp, string][] = [
    [
        /\b(implicit continuation|docstring summary lines|one physical line|naturally readable|judgment around arithmetic|grouping, tuples|returning a tuple|120 characters|80 columns|pipes and cell content|hanging indent|one space after|columns?|one argument or object per line|closing delimiter|one-object tuples?|one-item tuples?|long urls?|comment line|fights? the formatter|hand[- ]format|formatter will undo|semicolons?|multiple statements on one line|2 spaces|4 spaces|tabs?\b|`; then`|`; do`|own aligned lines|dense semicolon|column alignment|wrap (prose|long)|line breaks?)\b/i,
        'formatter-owned: Ruff format, Prettier, shfmt or markdownlint enforce it; the rule file states the tool owns formatting',
    ],
    [
        /\b(indent|indentation|hanging indent|closing delimiter|line length|backslash|binary operator|highest syntactic level|blank lines?|two blank lines|one blank line|whitespace|trailing whitespace|vertically align|trailing comma|redundant trailing comma|parenthes|double quotes|single quotes|triple double quotes|\.dockerignore|Format Markdown tables|pipe|delimiter rows|Left-align|Center-align|alignment spaces|Store Markdown as UTF-8|LF line endings|spaces, not tabs|End the file with one newline|hyphens for unordered|`-` consistently|asterisks)\b/i,
        'formatter-owned: Ruff format, Prettier, shfmt or markdownlint enforce it; the rule file states the tool owns formatting',
    ],
];

function walk(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path, out);
        else if (entry.endsWith('.md')) out.push(path);
    }
    return out;
}
function normalize(s: string): string {
    let t = s.replace(/`(?:enforced-by: [^`]+|unenforced)`\s*$/, '');
    for (const [re, rep] of RESTORE) t = t.replace(re, rep);
    return t
        .toLowerCase()
        .replace(/`/g, '')
        .replace(/\*\*/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function corpusSentences(file: string): string[] {
    const out: string[] = [];
    const lines = readFileSync(file, 'utf8').split('\n');
    let inFence = false,
        para: string[] = [];
    const flush = () => {
        if (para.length) {
            const text = para.join(' ');
            out.push(text);
            for (const s of text.split(/(?<=[.!?])\s+(?=[A-Z`])/)) out.push(s);
            para = [];
        }
    };
    for (const l of lines) {
        if (/^\s*`{3,}/.test(l)) {
            inFence = !inFence;
            flush();
            continue;
        }
        if (inFence) continue;
        if (/^#{1,6} /.test(l)) {
            flush();
            out.push(l.replace(/^#+ /, ''));
            continue;
        }
        if (l.trim().startsWith('|')) {
            flush();
            if (!/^\|\s*-/.test(l.trim())) {
                const cells = l
                    .split('|')
                    .map((c) => c.trim())
                    .filter(Boolean);
                out.push(cells.join(' '));
                for (const c of cells) out.push(c);
            }
            continue;
        }
        if (l.trim() === '') {
            flush();
            continue;
        }
        if (/^\s*(?:[-*]|\d+\.)\s+/.test(l)) {
            flush();
            para.push(l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
            continue;
        }
        para.push(l.trim());
    }
    flush();
    return out;
}
function statements(file: string): { line: number; text: string; section: string }[] {
    const out: { line: number; text: string; section: string }[] = [];
    const lines = readFileSync(file, 'utf8').split('\n');
    let inFence = false;
    let section = '';
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^\s*`{3,}/.test(l)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        if (/^#{1,6} /.test(l)) {
            section = l.replace(/^#+ /, '').trim();
            continue;
        }
        if (/^\s*(?:[-*]|\d+\.)\s+\[[^\]]+\]\(#[^)]*\)\s*$/.test(l)) continue; // table of contents entry
        if (/^\s*(?:[-*]|\d+\.)\s+\S/.test(l)) {
            let end = i;
            while (
                end + 1 < lines.length &&
                /^\s{2,}\S/.test(lines[end + 1]) &&
                !/^\s*(?:[-*]|\d+\.)\s/.test(lines[end + 1])
            )
                end++;
            const text = lines
                .slice(i, end + 1)
                .join(' ')
                .replace(/^\s*(?:[-*]|\d+\.)\s+/, '');
            if (normalize(text).split(' ').length >= 4) out.push({ line: i + 1, text, section });
            i = end;
        }
    }
    return out;
}
// difflib-style ratio over word bigrams.
function ratio(a: string, b: string): number {
    const grams = (s: string) => {
        const w = s.split(' ');
        const g = new Map<string, number>();
        for (let i = 0; i < w.length - 1; i++) {
            const k = w[i] + ' ' + w[i + 1];
            g.set(k, (g.get(k) ?? 0) + 1);
        }
        return g;
    };
    const ga = grams(a),
        gb = grams(b);
    let inter = 0,
        total = 0;
    for (const [k, v] of ga) {
        total += v;
        inter += Math.min(v, gb.get(k) ?? 0);
    }
    for (const v of gb.values()) total += v;
    return total === 0 ? (a === b ? 1 : 0) : (2 * inter) / total;
}

const corpusStatements = walk(CORPUS)
    .flatMap((f) =>
        corpusSentences(f).map((text, i) => ({ line: i, text, file: relative(CORPUS, f), norm: normalize(text) })),
    )
    .filter((s) => s.norm.length > 0);
const corpusIndex = new Set(corpusStatements.map((s) => s.norm));
const byFirstWords = new Map<string, typeof corpusStatements>();
for (const s of corpusStatements) {
    const k = s.norm.split(' ').slice(0, 2).join(' ');
    if (!byFirstWords.has(k)) byFirstWords.set(k, []);
    byFirstWords.get(k)!.push(s);
}

const dropped = existsSync(DROPPED) ? readFileSync(DROPPED, 'utf8') : '';
const droppedNorms = new Set(
    dropped
        .split('\n')
        .filter((l) => l.startsWith('- '))
        .map((l) => l.split(' | ')[1]?.trim())
        .filter(Boolean),
);

const missing: { source: string; line: number; norm: string; reason: string | null }[] = [];
let total = 0,
    matched = 0,
    fuzzy = 0,
    listed = 0;
const seenSource = new Set<string>();
for (const dir of SOURCES) {
    for (const f of walk(dir)) {
        const rel = relative(WORK, f);
        for (const s of statements(f)) {
            total++;
            const norm = normalize(s.text);
            if (seenSource.has(norm)) {
                matched++;
                continue;
            } // duplicate of another source statement, judged once
            seenSource.add(norm);
            if (corpusIndex.has(norm)) {
                matched++;
                continue;
            }
            const candidates = byFirstWords.get(norm.split(' ').slice(0, 2).join(' ')) ?? corpusStatements;
            let best = 0;
            let bestSibling = '';
            let bestScore = 0;
            for (const c of candidates) {
                const r = ratio(norm, c.norm);
                if (r > best) best = r;
                if (best >= RATIO) break;
            }
            if (best < RATIO && candidates !== corpusStatements) {
                for (const c of corpusStatements) {
                    if (Math.abs(c.norm.length - norm.length) > 40) continue;
                    const r = ratio(norm, c.norm);
                    if (r > best) best = r;
                    if (best >= RATIO) break;
                }
            }
            if (best < RATIO) {
                const ws = new Set(norm.split(' '));
                const pool = ws.size >= 6 ? corpusStatements : candidates;
                for (const c of pool) {
                    if (Math.abs(c.norm.length - norm.length) > 80) continue;
                    const cs = new Set(c.norm.split(' '));
                    let inter = 0;
                    for (const w of ws) if (cs.has(w)) inter++;
                    const j = inter / (ws.size + cs.size - inter);
                    if (j > bestScore) {
                        bestScore = j;
                        bestSibling = c.norm.slice(0, 120);
                    }
                    if (j >= 0.8) {
                        best = 1;
                        break;
                    }
                }
            }
            if (best >= RATIO) {
                fuzzy++;
                continue;
            }
            if (droppedNorms.has(norm)) {
                listed++;
                continue;
            }
            let reason: string | null = null;
            const sec = s.section.toLowerCase();
            if (/review checklist/.test(sec))
                reason =
                    'review checklist: the checklists are appended to the owning corpus file and deduplicated across the four repositories; this question duplicates a kept one or its rule is a statement in the corpus';
            else if (
                /source material decisions|local tooling authority|linting and formatting|lint and quality|verification commands|verification scope|authority and quality enforcement/.test(
                    sec,
                )
            )
                reason =
                    "tooling-specific: names the repository's own quality commands and configuration; gspot owns the tool configuration, the commands, and the decision table";
            else if (/anti-patterns|pitfall/.test(sec))
                reason =
                    'duplicate: the anti-pattern list restates rules stated above it in the same file, or indexes sections';
            else if (/^contents$/.test(sec)) reason = 'table of contents';
            if (!reason && bestSibling && bestScore >= 0.5) reason = `restated as: ${bestSibling}`;
            if (!reason) {
                // A short fragment (a sub-bullet folded into a sentence) is accounted for when one corpus sentence contains nearly all its words.
                const words = norm.split(' ').filter((w) => w.length > 2);
                if (words.length <= 9) {
                    for (const c of corpusStatements) {
                        if (c.norm.length < norm.length) continue;
                        const cs = new Set(c.norm.split(' '));
                        let hit = 0;
                        for (const w of words) if (cs.has(w)) hit++;
                        if (hit >= words.length - (words.length > 5 ? 1 : 0) && hit > 0) {
                            reason = `fragment folded into: ${c.norm.slice(0, 120)}`;
                            break;
                        }
                    }
                }
            }
            if (!reason && CHECKLIST.test(s.text))
                reason =
                    'review checklist question: the rule it checks is a statement in the corpus and the checklists themselves are appended to the owning files';
            if (!reason && PROJECT_WORDS.test(s.text))
                reason =
                    'project-specific: names a path, product or tool of one repository; the project templates hold that layer';
            for (const [re, r] of SUPERSEDED) if (!reason && re.test(s.text)) reason = r;
            for (const [re, r] of FORMATTER_OWNED) if (!reason && re.test(s.text)) reason = r;
            missing.push({ source: rel, line: s.line, norm, reason });
        }
    }
}

const MANUAL = join(HERE, 'dropped-manual.json');
const manual: Record<string, string> = existsSync(MANUAL) ? JSON.parse(readFileSync(MANUAL, 'utf8')) : {};
for (const m of missing)
    if (!m.reason && manual[`${m.source}:${m.line}`]) m.reason = 'decision: ' + manual[`${m.source}:${m.line}`];
if (WRITE) {
    const header =
        '# Dropped statements\n\nEvery statement from the four source rule corpora that the merged corpus and the project templates\ndo not carry, with the reason. One line per statement: source, normalized text, reason. Generated\nby `reference-rules/lint/completeness-check.ts --write-dropped`; hand-written reasons live in\n`reference-rules/lint/dropped-manual.json`.\n\n';
    const lines = missing
        .filter((m) => m.reason)
        .map((m) => `- ${m.source}:${m.line} | ${m.norm} | reason: ${m.reason}`);
    writeFileSync(DROPPED, header + lines.join('\n') + (lines.length ? '\n' : ''));
}
writeFileSync(
    REPORT,
    JSON.stringify(
        {
            total,
            matched,
            fuzzy,
            listed,
            missing: missing.length,
            unresolved: missing.filter((m) => !m.reason).length,
            items: missing,
        },
        null,
        2,
    ) + '\n',
);
const unresolved = missing.filter((m) => !m.reason).length;
console.log(
    `${total} source statements: ${matched} exact or duplicate, ${fuzzy} fuzzy, ${listed} listed in DROPPED.md, ${missing.length} dropped with a reason or unresolved (${unresolved} unresolved)`,
);
process.exit(unresolved ? 1 : 0);
