import { join } from 'node:path';
import { readFileSync } from 'node:fs';
// Every path-shaped token in Markdown names a tracked file or folder, and every `mise run` or `bun run` names a task that exists.
import { visit } from 'unist-util-visit';
import { parse as parseToml } from 'smol-toml';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { PathIndex, ProseLine } from '#types/integrity.ts';

import {
    FILE_EXTENSION,
    FREE_TEXT_FENCES,
    PATH_CHARS,
    PATH_TOKEN_SKIPS,
    RUN_TOKEN,
    TOKEN_SEPARATORS,
} from '#config/docs.ts';

const MISE_FILES = ['mise.toml', '.mise.toml', '.config/mise/config.toml', '.config/mise/conf.d/gspot.toml'];
const TRAILING_PUNCTUATION = '.,;:';

function knownPaths(input: EngineInput): Set<string> {
    const known = new Set<string>();
    for (const file of input.session.repository.files) {
        known.add(file.path);
        const segments = file.path.split('/');
        for (let depth = 1; depth < segments.length; depth += 1) known.add(segments.slice(0, depth).join('/'));
    }
    // A check id is written like a path, and a document that names supabase/config means the check, not a file.
    for (const manifest of input.session.manifests.values()) for (const check of manifest.checks) known.add(check.name);
    return known;
}

function miseTasks(root: string, file: string): string[] {
    try {
        const parsed = parseToml(readFileSync(join(root, file), 'utf8')) as { tasks?: Record<string, unknown> };
        return Object.keys(parsed.tasks ?? {});
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error(`Cannot read task definitions from ${file}.`, { cause: error });
    }
}

function packageScripts(root: string): string[] {
    try {
        const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
            scripts?: Record<string, unknown>;
        };
        return Object.keys(manifest.scripts ?? {});
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error('Cannot read task definitions from package.json.', { cause: error });
    }
}

function tasksOf(root: string): Set<string> {
    return new Set([...MISE_FILES.flatMap((file) => miseTasks(root, file)), ...packageScripts(root)]);
}

function proseLines(text: string): ProseLine[] {
    const ignored = new Set<number>();
    visit(fromMarkdown(text), 'code', (node) => {
        if (!FREE_TEXT_FENCES.includes(node.lang ?? '') || node.position === undefined) return;
        for (let line = node.position.start.line; line <= node.position.end.line; line += 1) ignored.add(line);
    });
    return text.split('\n').flatMap((line, index) => (ignored.has(index + 1) ? [] : [{ number: index + 1, line }]));
}

function normalized(token: string): string {
    return token.replace(/^\.\//u, '').replace(/\/$/u, '');
}

function withoutTrailingPunctuation(token: string): string {
    let end = token.length;
    while (end > 0 && TRAILING_PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
    return token.slice(0, end);
}

function pathTokens(line: string): string[] {
    return line
        .split(TOKEN_SEPARATORS)
        .map((token) => withoutTrailingPunctuation(token))
        .filter(
            (token) =>
                token.includes('/') && PATH_CHARS.test(token) && PATH_TOKEN_SKIPS.every((skip) => !skip.test(token)),
        );
}

// A token claims to be a path when it starts at a tracked top-level entry or ends in a file extension; `feat/order-export` is a branch, not a path.
function isPathClaim(token: string, index: PathIndex): boolean {
    const clean = normalized(token);
    const first = clean.split('/', 1)[0] ?? '';
    return index.known.has(first) || FILE_EXTENSION.test(clean);
}

function isMissing(token: string, index: PathIndex): boolean {
    const clean = normalized(token);
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

/**
 * One finding per path token that names nothing tracked and per run invocation that names no task.
 * @param input the engine input
 * @returns the findings
 */
export function stalePaths(input: EngineInput): Promise<Finding[]> {
    const exceptions = (input.view.tool('docs')['paths_allowed'] as { patterns: string[] }[] | undefined) ?? [];
    const isException = pathMatcher(exceptions.flatMap((entry) => entry.patterns));
    const index: PathIndex = { known: knownPaths(input), tasks: tasksOf(input.root), isException };
    const findings = input.files
        .filter((file) => file.nature === 'source' && file.path.endsWith('.md') && !isException(file.path))
        .flatMap((file) =>
            proseLines(readFileSync(join(input.root, file.path), 'utf8')).flatMap((prose) =>
                lineFindings(input, file.path, prose, index),
            ),
        );
    return Promise.resolve(findings);
}
