import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { RootContent } from 'mdast';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import { globPaths } from '#cli/platform/paths.ts';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { parseMiseTasks } from '#cli/parsers/mise.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { ProseLine } from '#cli/types/parsers/source.ts';
import { parsePackageManifest } from '#cli/parsers/packages.ts';
import { pathTokens, proseLines } from '#cli/parsers/markdown.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import type { PathIndex, ShapeProblem } from '#cli/types/checks/general/docs.ts';

import {
    RUN_TOKEN,
    MISE_FILES,
    START_WORDS,
    LICENSE_NAMES,
    SECTION_DEPTH,
    CONTENTS_TITLE,
    FILE_EXTENSION,
    BANNED_HEADINGS,
} from '#cli/config/checks/general/docs.ts';

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
        return parseMiseTasks(readSource(input.root, file, input.reads).toString('utf8'));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error(`Cannot read task definitions from ${file}.`, { cause: error });
    }
}

function packageScripts(input: EngineInput): string[] {
    try {
        const manifest = parsePackageManifest(readSource(input.root, 'package.json', input.reads).toString('utf8'));
        return Object.keys(manifest.scripts ?? {});
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error('Cannot read task definitions from package.json.', { cause: error });
    }
}

// A token counts as a path when it starts at a tracked top-level entry or ends in a file extension; `feat/order-export` is a branch, not a path.
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

function openingProblem(nodes: RootContent[]): ShapeProblem[] {
    const title = nodes.findIndex((node) => node.type === 'heading' && node.depth === 1);
    const start = title === -1 ? 0 : title;
    const section = nodes.findIndex(
        (node, index) => index >= start && node.type === 'heading' && node.depth === SECTION_DEPTH,
    );
    const opening = nodes.slice(start, section === -1 ? nodes.length : section);
    return opening.some((node) => node.type === 'paragraph')
        ? []
        : [
              [
                  nodes[start]?.position?.start.line ?? 1,
                  'opening-paragraph',
                  'Add a paragraph between the title and the first H2.',
              ],
          ];
}

function sectionProblems(nodes: RootContent[], threshold: number): ShapeProblem[] {
    const sections = nodes
        .filter((node) => node.type === 'heading' && node.depth === SECTION_DEPTH)
        .map((node) => toString(node).trim().toLowerCase());
    const problems: ShapeProblem[] = [];
    if (sections.length > threshold && !sections.includes(CONTENTS_TITLE))
        problems.push([
            1,
            'contents',
            `This README has ${String(sections.length)} H2 headings, over the limit of ${String(threshold)}. Add a Contents section.`,
        ]);
    return problems;
}

/**
 * One finding per path token that names nothing tracked and per run invocation that names no task.
 * @param input the engine input
 * @returns the findings
 */
export function stalePaths(input: EngineInput): Finding[] {
    const exceptions = (input.view.options('docs')['exclude'] as PathAllowance[] | undefined) ?? [];
    const isException = pathMatcher(exceptions.flatMap((entry) => entry.paths));
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

/**
 * One finding per scope without a README.md, and one when the root has no license file.
 * @param input the engine input
 * @returns the findings
 */
export function readmePresent(input: EngineInput): Finding[] {
    const isLicenseRequired = input.view.options('docs')['license'] !== false;
    const findings: Finding[] = [];
    const readme = input.scope === '' ? 'README.md' : `${input.scope}/README.md`;
    if (statSync(join(input.root, readme), { throwIfNoEntry: false }) === undefined)
        findings.push(
            findingAt(
                input,
                { file: readme },
                'missing-readme',
                `The scope ${input.scope === '' ? 'root' : input.scope} has no README.md.`,
            ),
        );
    if (
        isLicenseRequired &&
        input.scope === '' &&
        LICENSE_NAMES.every((name) => statSync(join(input.root, name), { throwIfNoEntry: false }) === undefined)
    )
        findings.push(findingAt(input, { file: 'LICENSE' }, 'missing-license', 'The root has no LICENSE file.'));
    return findings;
}

/**
 * The shape findings for every README in the check's files.
 * @param input the engine input
 * @returns the findings
 */
export function readmeShape(input: EngineInput): Finding[] {
    const threshold = input.view.settings['limits.docs.headings_before_contents'] as number;
    const roots = new Set(['README.md', ...input.scopeEntries.map((scope) => `${scope.path}/README.md`)]);
    return input.files
        .filter(
            (file) =>
                (file.path === 'README.md' || file.path.endsWith('/README.md')) &&
                statSync(join(input.root, file.path), { throwIfNoEntry: false }) !== undefined,
        )
        .flatMap((file) => {
            const nodes = fromMarkdown(readSource(input.root, file.path, input.reads).toString('utf8')).children;
            const problems = [...openingProblem(nodes), ...sectionProblems(nodes, threshold)];
            if (roots.has(file.path)) {
                const sections = nodes.filter((node) => node.type === 'heading' && node.depth === SECTION_DEPTH);
                if (sections.every((node) => START_WORDS.every((word) => !toString(node).toLowerCase().includes(word))))
                    problems.push([1, 'start-section', `Add a section whose heading names ${START_WORDS.join(', ')}.`]);
            }
            return problems.map(([line, rule, text]) => findingAt(input, { file: file.path, line }, rule, text));
        });
}

/**
 * One finding per heading that matches the banned list or [docs] banned_headings.
 * @param input the engine input
 * @returns the findings
 */
export function headings(input: EngineInput): Finding[] {
    const verbatim = (input.view.options('docs')['banned_headings'] as string[] | undefined) ?? [];
    const banned = new Set([...BANNED_HEADINGS, ...verbatim.map((heading) => heading.toLowerCase())]);
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (file.kind !== 'source' || !file.path.endsWith('.md')) continue;
        const tree = fromMarkdown(readSource(input.root, file.path, input.reads).toString('utf8'));
        visit(tree, 'heading', (heading) => {
            const text = toString(heading).trim();
            if (banned.has(text.toLowerCase()))
                findings.push(
                    findingAt(
                        input,
                        { file: file.path, line: heading.position?.start.line ?? 1 },
                        'banned-heading',
                        `The heading "${text}" promises an inventory; explain the thing instead.`,
                    ),
                );
        });
    }
    return findings;
}
