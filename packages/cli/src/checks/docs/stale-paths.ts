import { globbySync } from 'globby';
import { visit } from 'unist-util-visit';
import { parse as parseToml } from 'smol-toml';
import type { Finding } from '#cli/checks/result.ts';
import { MISE_CONFIG_PATH } from '#cli/tools/mise.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { readSource } from '#cli/repository/tracked.ts';

type PathIndex = { known: Set<string>; tasks: Set<string>; isException: (path: string) => boolean };

type ProseLine = { number: number; line: string };

const MISE_FILES = ['mise.toml', '.mise.toml', '.config/mise/config.toml', MISE_CONFIG_PATH];
const TRAILING_PUNCTUATION = '.,;:';

function knownPaths(input: EngineInput): Set<string> {
    const known = new Set<string>();
    if (input.repositoryFiles === undefined)
        throw new Error('The stale-paths check requires a once-only repository inventory.');
    for (const file of input.repositoryFiles) {
        known.add(file.path);
        const segments = file.path.split('/');
        for (let depth = 1; depth < segments.length; depth += 1) known.add(segments.slice(0, depth).join('/'));
    }
    // A check id is written like a path, and a document that names supabase/config means the check, not a file.
    for (const manifest of input.manifests.values()) for (const check of manifest.checks) known.add(check.name);
    return known;
}

function miseTasks(input: EngineInput, file: string): string[] {
    try {
        const parsed = parseToml(readSource(input.root, file, input.observations).toString('utf8')) as {
            tasks?: Record<string, unknown>;
        };
        return Object.keys(parsed.tasks ?? {});
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error(`Cannot read task definitions from ${file}.`, { cause: error });
    }
}

function packageScripts(input: EngineInput): string[] {
    try {
        const manifest = JSON.parse(readSource(input.root, 'package.json', input.observations).toString('utf8')) as {
            scripts?: Record<string, unknown>;
        };
        return Object.keys(manifest.scripts ?? {});
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error('Cannot read task definitions from package.json.', { cause: error });
    }
}

function tasksOf(input: EngineInput): Set<string> {
    return new Set([
        ...[...new Set([...MISE_FILES, ...globbySync('.mise/conf.d/*.toml', { cwd: input.root, dot: true })])].flatMap(
            (file) => miseTasks(input, file),
        ),
        ...packageScripts(input),
    ]);
}

function proseLines(text: string): ProseLine[] {
    const ignored = new Set<number>();
    visit(fromMarkdown(text), 'code', (node) => {
        if (!FREE_TEXT_FENCES.has(node.lang ?? '') || node.position === undefined) return;
        for (let line = node.position.start.line; line <= node.position.end.line; line += 1) ignored.add(line);
    });
    return text.split('\n').flatMap((line, index) => (ignored.has(index + 1) ? [] : [{ number: index + 1, line }]));
}

function withoutTrailingPunctuation(token: string): string {
    let end = token.length;
    while (end > 0 && TRAILING_PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
    return token.slice(0, end);
}

function pathTokens(line: string): string[] {
    return line
        .split(TOKEN_SEPARATORS)
        .map(withoutTrailingPunctuation)
        .filter(
            (token) =>
                token.includes('/') && PATH_CHARS.test(token) && PATH_TOKEN_SKIPS.every((skip) => !skip.test(token)),
        );
}

// A token claims to be a path when it starts at a tracked top-level entry or ends in a file extension; `feat/order-export` is a branch, not a path.
function isPathClaim(token: string, index: PathIndex): boolean {
    const clean = token.replace(/^\.\//u, '').replace(/\/$/u, '');
    const first = clean.split('/', 1)[0] ?? '';
    return index.known.has(first) || FILE_EXTENSION.test(clean);
}

function isMissing(token: string, index: PathIndex): boolean {
    const clean = token.replace(/^\.\//u, '').replace(/\/$/u, '');
    return isPathClaim(token, index) && !index.known.has(clean) && !index.isException(clean);
}

function lineFindings(input: EngineInput, file: string, prose: ProseLine, index: PathIndex): Finding[] {
    const { number, line } = prose;
    const paths = pathTokens(line)
        .filter((token) => isMissing(token, index))
        .map((token) => ({
            check: input.spec.name,
            file,
            line: number,
            rule: 'missing-path',
            message: `${token} names no tracked file or folder.`,
            fixable: false,
        }));
    const runs = line
        .matchAll(RUN_TOKEN)
        .filter((match) => !index.tasks.has(match.groups?.['task'] ?? ''))
        .map((match) => ({
            check: input.spec.name,
            file,
            line: number,
            rule: 'missing-task',
            message: `${match[0]} names no task or script.`,
            fixable: false,
        }))
        .toArray();
    return [...paths, ...runs];
}

const PATH_CHARS = /^[\w./-]+$/u;

const TOKEN_SEPARATORS = /[\s`'"()[\],;:!?<>|*]+/u;

const RUN_TOKEN = /\b(?<runner>mise|bun|npm|pnpm|yarn) run (?<task>[\w:.-]+)/gu;

const FREE_TEXT_FENCES = new Set(['text', 'plaintext', 'console', 'diff']);

const FILE_EXTENSION = /\.[a-z0-9]+$/iu;

const PATH_TOKEN_SKIPS = [/^https?:/u, /^[a-z]+:\/\//u, /^\.\.?\/?$/u, /^\/dev\//u, /^\d+\/\d+$/u, /^\//u];

/**
 * One finding per path token that names nothing tracked and per run invocation that names no task.
 * @param input the engine input
 * @returns the findings
 */
export function stalePaths(input: EngineInput): Finding[] {
    const exceptions = (input.view.tool('docs')['paths_allowed'] as { patterns: string[] }[] | undefined) ?? [];
    const isException = pathMatcher(exceptions.flatMap((entry) => entry.patterns));
    const index: PathIndex = { known: knownPaths(input), tasks: tasksOf(input), isException };
    return input.files
        .filter((file) => file.nature === 'source' && file.path.endsWith('.md') && !isException(file.path))
        .flatMap((file) =>
            proseLines(readSource(input.root, file.path, input.observations).toString('utf8')).flatMap((prose) =>
                lineFindings(input, file.path, prose, index),
            ),
        );
}
