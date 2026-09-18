// Lints the rule corpus: front matter, markers, links, size, layer boundary, fences, corruption, Vale.
// Usage: bun corpus-lint.ts [path...]   Exit 1 on any finding.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = new URL('.', import.meta.url).pathname;
const CORPUS = join(HERE, '..', 'merged');
const IDS = new Set(readFileSync(join(HERE, 'check-ids.txt'), 'utf8').split('\n').filter(Boolean));
const LAYERS = new Set([
    'agent',
    'code',
    'prose',
    'language',
    'runtime',
    'framework',
    'library',
    'tool',
    'platform',
    'database',
    'shared',
    'repository',
    'template',
]);
const PRESETS = new Set(
    readdirSync(join(HERE, '..', '..', 'architecture', 'presets'))
        .filter((f) => f.endsWith('.md') && f !== 'README.md')
        .map((f) => f.replace(/\.md$/, ''))
        .concat(['rules', 'none']),
);
const CEILING = 800;
const FENCE_LANGS = new Set([
    'ts',
    'tsx',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'python',
    'py',
    'swift',
    'bash',
    'sh',
    'shell',
    'sql',
    'toml',
    'json',
    'jsonc',
    'yaml',
    'yml',
    'text',
    'plaintext',
    'markdown',
    'md',
    'html',
    'css',
    'dockerfile',
    'diff',
    'dotenv',
    'mermaid',
    'http',
    'xml',
    'plist',
    'ini',
    'nginx',
    'makefile',
    'console',
]);
const BOUNDARY_LAYERS = new Set(['agent', 'code', 'prose', 'language']);
const BOUNDARY_WORDS = [
    /\bsrc\/app\b/,
    /\bsrc\/modules\b/,
    /\bplatform\/(db|providers)\b/,
    /\bsupabase\/(migrations|functions)\b/,
    /\bVirtua\b/,
    /\bPino\b/,
    /\byap\b/i,
    /\bslopshop\b/i,
    /\bHugging Face\b/,
    /\bTensorRT\b/,
    /\bvLLM\b/,
    /\bCloudflare Pages\b/,
    /\bHetzner\b/,
    /\bVercel\b/,
];
const CORRUPTION = [
    /z\.item\(/,
    /\bitem literal/,
    /\bsource item\b/,
    /\bitem keys\b/,
    /package[- ]coordinator/,
    /secret coordinator/,
    /service-coordinator/,
    /\baccess command\b/,
    /\bplatform command\b/,
    /\bsource command\b/,
    /\bprocess command\b/,
    /access-command/,
    /\bproject operators\b/,
    /\bproject controls\b/,
    /\bproject regex\b/,
    /\bproject Bash harnesses\b/,
    /encodedBytes/,
    /code: 'project'/,
];
const MARKER = /`(enforced-by: ([^`]+)|unenforced)`\s*$/;

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path, out);
        else if (entry.endsWith('.md')) out.push(path);
    }
    return out;
}

const findings: string[] = [];
const report = (file: string, line: number, message: string) => findings.push(`${file}:${line}: ${message}`);

const targets = process.argv.slice(2).length ? process.argv.slice(2) : walk(CORPUS);
for (const file of targets) {
    const rel = relative(CORPUS, file);
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    // front matter
    const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fm) {
        report(rel, 1, 'missing front matter');
    } else {
        const fields = Object.fromEntries(fm[1].split('\n').map((l) => l.split(/:\s*/, 2) as [string, string]));
        if (!LAYERS.has(fields.layer)) report(rel, 2, `unknown layer '${fields.layer}'`);
        if (!PRESETS.has(fields.preset)) report(rel, 3, `unknown preset '${fields.preset}'`);
        const h1 = text.match(/^# (.+)$/m)?.[1];
        if (h1 !== fields.title) report(rel, 4, `title '${fields.title}' does not equal the H1 '${h1}'`);
        const expectedLayer = rel.startsWith('general/')
            ? rel.split('/')[1]
            : rel.startsWith('templates/')
              ? 'template'
              : rel.split('/')[0];
        if (fields.layer !== expectedLayer)
            report(rel, 2, `layer '${fields.layer}' does not match the path ('${expectedLayer}')`);
    }
    // size
    if (!rel.startsWith('templates/') && lines.length > CEILING)
        report(rel, lines.length, `${lines.length} lines exceeds the ${CEILING}-line ceiling`);
    // per line
    let inFence = false;
    let fenceLine = 0;
    const isTemplate = rel.startsWith('templates/');
    const layer = rel.startsWith('general/') ? rel.split('/')[1] : rel.split('/')[0];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const n = i + 1;
        const fenceOpen = line.match(/^\s*(`{3,})\s*(\S*)/);
        if (fenceOpen) {
            if (!inFence) {
                inFence = true;
                fenceLine = n;
                const lang = fenceOpen[2];
                if (!lang) report(rel, n, 'fenced block without a language tag');
                else if (!FENCE_LANGS.has(lang)) report(rel, n, `fence language '${lang}' is not in the allowed set`);
                var fenceTicks = fenceOpen[1];
            } else if (line.trim() === fenceTicks) {
                inFence = false;
            }
            continue;
        }
        if (inFence) continue;
        for (const re of CORRUPTION) if (re.test(line)) report(rel, n, `corruption residue: ${re.source}`);
        if (
            /\]\((?:\.\.\/)*(?:general|language|runtime|framework|library|tool|platform|database|shared|repository)\/[^)]+\.md\)/.test(
                line,
            )
        )
            report(rel, n, 'link to another rule file');
        if (/[—]/.test(line)) report(rel, n, 'em dash');
        if (BOUNDARY_LAYERS.has(layer) && !isTemplate) {
            for (const re of BOUNDARY_WORDS)
                if (re.test(line) && !/`[^`]*`/.test(line))
                    report(rel, n, `layer boundary: '${re.source}' in a ${layer} file`);
        }
        if (!isTemplate) {
            const m = line.match(MARKER);
            if (m && m[2]) {
                const id = m[2].trim().split(' ')[0];
                if (!IDS.has(id)) report(rel, n, `unknown check id '${id}'`);
            }
        }
    }
    if (inFence) report(rel, fenceLine, 'unclosed fenced block');
}

// Vale, when present.
const vale = spawnSync('vale', ['--version'], { encoding: 'utf8' });
if (vale.error) console.log('vale not installed; prose rules skipped');
else {
    const run = spawnSync('vale', ['--config', join(HERE, 'vale', '.vale.ini'), '--output', 'line', CORPUS], {
        encoding: 'utf8',
    });
    for (const l of run.stdout.split('\n').filter(Boolean)) findings.push(l.replace(CORPUS + '/', ''));
}

for (const f of findings) console.log(f);
console.log(`${findings.length} findings over ${targets.length} files`);
process.exit(findings.length ? 1 : 0);
