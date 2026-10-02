// Documented paths and run commands that name nothing tracked: a path claim or a task that does not exist.
import { posix } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { globPaths } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { ProseLine } from '#cli/types/parsers/parsers.ts';
import type { PathIndex } from '#cli/types/checks/general/docs.ts';
import { pathTokens, proseLines } from '#cli/parsers/references.ts';
import { MISE_CONFIG_PATH } from '#cli/config/generation/generation.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { RUN_TOKEN, FILE_EXTENSION } from '#cli/config/checks/general/docs.ts';

const MISE_FILES = ['mise.toml', '.mise.toml', '.config/mise/config.toml', MISE_CONFIG_PATH];
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
    for (const check of input.policyFiles.policy.checks) known.add(check.name);
    return known;
}

function miseTasks(input: EngineInput, file: string): string[] {
    try {
        const parsed = parseToml(readSource(input.root, file, input.reads).toString('utf8')) as {
            tasks?: Record<string, { alias?: string | string[] }>;
        };
        return Object.entries(parsed.tasks ?? {}).flatMap(([name, task]) => [name, ...[task.alias ?? []].flat()]);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error(`Cannot read task definitions from ${file}.`, { cause: error });
    }
}

function packageScripts(input: EngineInput): string[] {
    try {
        const manifest = JSON.parse(readSource(input.root, 'package.json', input.reads).toString('utf8')) as {
            scripts?: Record<string, unknown>;
        };
        return Object.keys(manifest.scripts ?? {});
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error('Cannot read task definitions from package.json.', { cause: error });
    }
}

// A token owners to be a path when it starts at a tracked top-level entry or ends in a file extension; `feat/order-export` is a branch, not a path.
function isPathClaim(token: string, index: PathIndex): boolean {
    const clean = token.replace(/^\.\//u, '').replace(/\/$/u, '');
    const first = clean.split('/', 1)[0] ?? '';
    return token.startsWith('./') || token.startsWith('../') || index.known.has(first) || FILE_EXTENSION.test(clean);
}

function isMissing(token: string, file: string, index: PathIndex): boolean {
    const clean = token.replace(/^\.\//u, '').replace(/\/$/u, '');
    const relative = posix.normalize(posix.join(posix.dirname(file), clean));
    if (index.isException(clean) || index.known.has(relative)) return false;
    if (token.startsWith('./') || token.startsWith('../')) return true;
    return isPathClaim(token, index) && !index.known.has(clean);
}

function lineFindings(input: EngineInput, file: string, prose: ProseLine, index: PathIndex): Finding[] {
    const { number, line } = prose;
    const paths = pathTokens(line)
        .filter((token) => isMissing(token, file, index))
        .map((token) =>
            findingAt(input, { file, line: number }, 'missing-path', `${token} names no tracked file or folder.`),
        );
    const runs = line
        .matchAll(RUN_TOKEN)
        .filter((match) => !index.tasks.has(match.groups?.['task'] ?? ''))
        .map((match) =>
            findingAt(input, { file, line: number }, 'missing-task', `${match[0]} names no task or script.`),
        )
        .toArray();
    return [...paths, ...runs];
}

/**
 * One finding per path token that names nothing tracked and per run invocation that names no task.
 * @param input the engine input
 * @returns the findings
 */
export function stalePaths(input: EngineInput): Finding[] {
    const exceptions = (input.view.tool('docs')['paths_allowed'] as { patterns: string[] }[] | undefined) ?? [];
    const isException = pathMatcher(exceptions.flatMap((entry) => entry.patterns));
    const index: PathIndex = {
        known: knownPaths(input),
        tasks: new Set([
            ...[...new Set([...MISE_FILES, ...globPaths(input.root, '.mise/conf.d/*.toml', { dot: true })])].flatMap(
                (file) => miseTasks(input, file),
            ),
            ...packageScripts(input),
        ]),
        isException,
    };
    return input.files
        .filter((file) => file.kind === 'source' && file.path.endsWith('.md') && !isException(file.path))
        .flatMap((file) =>
            proseLines(readSource(input.root, file.path, input.reads).toString('utf8')).flatMap((prose) =>
                lineFindings(input, file.path, prose, index),
            ),
        );
}
