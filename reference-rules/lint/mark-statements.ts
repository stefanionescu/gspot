// Appends an enforcement marker to every rule statement in the corpus.
// A rule statement is a list item, or a paragraph whose first word is an imperative.
// The marker is `enforced-by: <check-id>` when a mapping matches, else `unenforced`.
// Usage: bun mark-statements.ts [--check]   (--check reports unmarked statements and exits 1)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const CORPUS = join(HERE, '..', 'merged');
const MAP_FILE = join(HERE, 'enforcement-map.json');
const IDS_FILE = join(HERE, 'check-ids.txt');
const OUT_FILE = join(HERE, 'unenforced.json');
const CHECK = process.argv.includes('--check');

type Mapping = { files: string; pattern: string; check: string };
const mappings: Mapping[] = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
const knownIds = new Set(readFileSync(IDS_FILE, 'utf8').split('\n').filter(Boolean));
const MARKER = /\s*`(?:enforced-by: [^`]+|unenforced)`\s*$/;
const IMPERATIVE =
    /^(Do not|Never|Always|Use|Keep|Prefer|Avoid|Put|Run|Read|Write|Treat|Validate|Reject|Return|Raise|Throw|Catch|Name|Mark|Pin|Quote|Check|Store|Pass|Import|Export|Compare|Convert|Handle|Group|Sort|Split|Choose|Declare|Define|Delete|Remove|Add|Give|Set|Make|Let|Place|Test|Verify|Include|Exclude|Follow|Match|Respect|Bound|Limit|Wrap|Escape|Sanitize|Hash|Sign|Log|Report|Print|Send|Fail|Exit|Close|Release|Await|Cancel|Retry|Persist|Reset|Restore|Enable|Disable|Configure|Install|Regenerate|Order|Annotate|Document|Explain|State|Describe|Restate|Provide|Expose|Hide|Ban|Refuse|Require|Emit|Format|Trim|Normalize|Translate|Map|Derive|Compute|Cache|Invalidate|Load|Fetch|Select|Insert|Update|Extract|Inline|Promote|Move|Colocate|Separate|Wait|Block|Allow|Skip|Ignore|Commit|Push|Rebase|Branch|Squash|Every|Each|One|No|Nothing)\b/;

function globToRegex(glob: string): RegExp {
    const re = glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\0')
        .replace(/\*/g, '[^/]*')
        .replace(/\0/g, '.*');
    return new RegExp('^' + re + '$');
}
const compiled = mappings.map((m) => ({
    files: globToRegex(m.files),
    pattern: new RegExp(m.pattern, 'i'),
    check: m.check,
}));

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path, out);
        else if (entry.endsWith('.md')) out.push(path);
    }
    return out;
}

function checkFor(rel: string, statement: string): string | null {
    for (const m of compiled) {
        if (m.files.test(rel) && m.pattern.test(statement)) return m.check;
    }
    return null;
}

const counts: Record<string, { statements: number; unenforced: number }> = {};
let unmarked = 0;
const badIds = new Set<string>();

for (const file of walk(CORPUS)) {
    const rel = relative(CORPUS, file);
    if (rel.startsWith('templates/')) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    const out: string[] = [];
    let inFence = false;
    let inFrontMatter = false;
    let statements = 0;
    let unenforced = 0;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (i === 0 && line === '---') {
            inFrontMatter = true;
            out.push(line);
            continue;
        }
        if (inFrontMatter) {
            out.push(line);
            if (line === '---') inFrontMatter = false;
            continue;
        }
        if (/^\s*`{3,}/.test(line)) {
            inFence = !inFence;
            out.push(line);
            continue;
        }
        if (inFence) {
            out.push(line);
            continue;
        }
        const isList = /^\s*(?:[-*]|\d+\.)\s+\S/.test(line) && !/^\s*[-*]\s+\[/.test(line);
        const isTable = line.trim().startsWith('|');
        const isHeading = /^#{1,6} /.test(line);
        const prevBlank = i === 0 || lines[i - 1].trim() === '';
        const isParagraphStart =
            prevBlank &&
            !isList &&
            !isTable &&
            !isHeading &&
            line.trim() !== '' &&
            !/^\s{2,}/.test(line) &&
            !/^(Bad|Good|Avoid|Use|Rules|Example|Examples|Good [^:]*|Bad [^:]*)[:]$/.test(line.trim());
        const isStatement = isList || (isParagraphStart && IMPERATIVE.test(line.trim()));
        if (!isStatement) {
            out.push(line);
            continue;
        }
        // An item or sentence that ends with a colon introduces a list or a block; the rule is what follows.
        {
            let last = i;
            while (
                last + 1 < lines.length &&
                /^\s{2,}\S/.test(lines[last + 1]) &&
                !/^\s*(?:[-*]|\d+\.)\s/.test(lines[last + 1])
            )
                last++;
            if (/:\s*(`(?:enforced-by: [^`]+|unenforced)`)?\s*$/.test(lines[last])) {
                for (let k = i; k <= last; k++) out.push(lines[k].replace(MARKER, ''));
                i = last;
                continue;
            }
        }
        // A statement may wrap onto continuation lines; the marker goes on its last line.
        let end = i;
        while (
            end + 1 < lines.length &&
            /^\s{2,}\S/.test(lines[end + 1]) &&
            !/^\s*(?:[-*]|\d+\.)\s/.test(lines[end + 1])
        )
            end++;
        const block = lines.slice(i, end + 1);
        const text = block.join(' ').replace(/\s+/g, ' ').replace(MARKER, '');
        statements++;
        const existing = block[block.length - 1].match(MARKER);
        if (CHECK) {
            if (!existing) {
                unmarked++;
                console.log(`${rel}:${i + 1} has no marker`);
            } else if (existing[0].includes('enforced-by')) {
                const id = existing[0]
                    .replace(/.*enforced-by: /, '')
                    .replace(/`.*$/, '')
                    .trim()
                    .split(' ')[0];
                if (!knownIds.has(id)) badIds.add(id);
            }
            if (!existing || existing[0].includes('unenforced')) unenforced++;
            out.push(...block);
            i = end;
            continue;
        }
        const check = checkFor(rel, text);
        const marker = check ? ` \`enforced-by: ${check}\`` : ' `unenforced`';
        if (!check) unenforced++;
        block[block.length - 1] = block[block.length - 1].replace(MARKER, '') + marker;
        out.push(...block);
        i = end;
    }
    counts[rel] = { statements, unenforced };
    if (!CHECK) writeFileSync(file, out.join('\n'));
}

const total = Object.values(counts).reduce((a, c) => a + c.statements, 0);
const totalUnenforced = Object.values(counts).reduce((a, c) => a + c.unenforced, 0);
writeFileSync(OUT_FILE, JSON.stringify(counts, null, 4) + '\n');
console.log(`${total} statements, ${totalUnenforced} unenforced (${Math.round((100 * totalUnenforced) / total)}%)`);
if (CHECK) {
    if (unmarked) console.log(`${unmarked} statements without a marker`);
    if (badIds.size) console.log(`unknown check ids: ${[...badIds].join(', ')}`);
    process.exit(unmarked || badIds.size ? 1 : 0);
}
