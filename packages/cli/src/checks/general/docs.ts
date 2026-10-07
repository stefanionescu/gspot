import { join, posix } from 'node:path';
import type { RootContent } from 'mdast';
import { visit } from 'unist-util-visit';
import { statSync, readdirSync } from 'node:fs';
import { toString } from 'mdast-util-to-string';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import { parseMiseTasks } from '#cli/parsers/mise.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { ProseLine } from '#cli/types/parsers/source.ts';
import { runnerSchema } from '#cli/parsers/schema/settings.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { globPaths, expandPaths } from '#cli/platform/paths.ts';
import { parsePackageManifest } from '#cli/parsers/packages.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import { isGlob, pathMatcher } from '#cli/repository/selectors.ts';
import { scopeOf, scopeAncestors } from '#cli/repository/scopes.ts';
import { MISE_FILES, LICENSE_FILE } from '#cli/config/repository/inventory.ts';
import type { PathIndex, TaskSources } from '#cli/types/checks/general/docs.ts';
import { pathTokens, proseLines, cleanPathToken } from '#cli/parsers/markdown.ts';

import {
    START_WORDS,
    SECTION_DEPTH,
    CONTENTS_TITLE,
    FILE_EXTENSION,
    BANNED_HEADINGS,
} from '#cli/config/checks/general/docs.ts';

function knownPaths(input: CheckInput): Set<string> {
    if (input.repositoryFiles === undefined)
        throw new Error(
            'The docs/stale-paths check needs the full list of tracked files. Its manifest must say runs = "once".',
        );
    const known = expandPaths(input.repositoryFiles.map((file) => file.path));
    const ignored = input.repositoryFiles
        .filter((file) => posix.basename(file.path) === '.gitignore')
        .flatMap((file) =>
            readSource(input.root, file.path, input.reads)
                .toString('utf8')
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('!') && !isGlob(line))
                .map((line) => posix.join(posix.dirname(file.path), line.replace(/^\//u, '').replace(/\/$/u, ''))),
        );
    for (const path of expandPaths(ignored)) known.add(path);
    // A check id is written like a path, and a document that names supabase/config means the check, not a file.
    for (const manifest of input.manifests.values()) for (const check of manifest.checks) known.add(check.name);
    for (const check of input.policyFiles.policy.checks) known.add(check.name);
    return known;
}

function miseTasks(input: CheckInput, file: string): string[] {
    try {
        return parseMiseTasks(readSource(input.root, file, input.reads).toString('utf8'));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error(`Cannot read task definitions from ${file}.`, { cause: error });
    }
}

function packageScripts(input: CheckInput, file: string): string[] | undefined {
    try {
        const manifest = parsePackageManifest(readSource(input.root, file, input.reads).toString('utf8'));
        return manifest.scripts === undefined ? [] : Object.keys(manifest.scripts);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw new Error(`Cannot read task definitions from ${file}.`, { cause: error });
    }
}

function isMissing(token: string, file: string, index: PathIndex): boolean {
    const clean = cleanPathToken(token);
    const relative = posix.normalize(posix.join(posix.dirname(file), clean));
    if (index.isException(clean) || index.known.has(relative)) return false;
    if (token.startsWith('./') || token.startsWith('../')) return true;
    const first = clean.split('/', 1)[0] ?? '';
    return (index.known.has(first) || FILE_EXTENSION.test(clean)) && !index.known.has(clean);
}

function lineFindings(input: CheckInput, file: string, prose: ProseLine, index: PathIndex): Finding[] {
    const { number, line } = prose;
    const paths = pathTokens(line)
        .filter((token) => isMissing(token, file, index))
        .map((token) =>
            findingAt(input, { file, line: number }, 'missing-path', `${token} names no tracked file or folder.`),
        );
    const runToken = new RegExp(String.raw`\b(?:${runnerSchema.options.join('|')}) run [\w:.-]+`, 'gu');
    const runs = line
        .matchAll(runToken)
        .filter((match) => {
            const command = match[0];
            const names = command.startsWith('mise run ') ? index.tasks.mise : index.tasks.packages;
            return !names.has(command.slice(command.lastIndexOf(' ') + 1));
        })
        .map((match) =>
            findingAt(input, { file, line: number }, 'missing-task', `${match[0]} names no task or script.`),
        )
        .toArray();
    return [...paths, ...runs];
}

function openingFindings(input: CheckInput, file: string, nodes: RootContent[]): Finding[] {
    const title = nodes.findIndex((node) => node.type === 'heading' && node.depth === 1);
    const start = title === -1 ? 0 : title;
    const section = nodes.findIndex(
        (node, index) => index >= start && node.type === 'heading' && node.depth === SECTION_DEPTH,
    );
    const opening = nodes.slice(start, section === -1 ? nodes.length : section);
    return opening.some((node) => node.type === 'paragraph')
        ? []
        : [
              findingAt(
                  input,
                  { file, line: nodes[start]?.position?.start.line ?? 1 },
                  'opening-paragraph',
                  'Add a paragraph between the title and the first H2.',
              ),
          ];
}

function sectionFindings(input: CheckInput, file: string, nodes: RootContent[], threshold: number): Finding[] {
    const sections = nodes
        .filter((node) => node.type === 'heading' && node.depth === SECTION_DEPTH)
        .map((node) => toString(node).trim().toLowerCase());
    if (sections.length <= threshold || sections.includes(CONTENTS_TITLE)) return [];
    return [
        findingAt(
            input,
            { file, line: 1 },
            'contents',
            `This README has ${String(sections.length)} H2 headings, over the limit of ${String(threshold)}. Add a Contents section.`,
        ),
    ];
}

function taskSources(input: CheckInput, scope: string): TaskSources {
    const ancestors = scopeAncestors(input.scopeEntries, scope).toReversed();
    const files = [
        ...new Set(
            ancestors.flatMap(({ path }) => [
                ...MISE_FILES.filter((file) => file !== '.tool-versions').map((file) => posix.join(path, file)),
                ...globPaths(input.root, posix.join(path, '.mise/conf.d/*.toml'), { dot: true }),
            ]),
        ),
    ];
    let scripts: string[] = [];
    for (const { path } of ancestors) {
        const found = packageScripts(input, posix.join(path, 'package.json'));
        if (found === undefined) continue;
        scripts = found;
        break;
    }
    return {
        mise: new Set(files.flatMap((file) => miseTasks(input, file))),
        packages: new Set(scripts),
    };
}

/**
 * One finding per path token that names nothing tracked and per run invocation that names no task.
 * @param input the check input
 * @returns the findings
 */
export function stalePaths(input: CheckInput): Finding[] {
    const exceptions = (input.view.options('docs')['exclude'] as PathAllowance[] | undefined) ?? [];
    const isException = pathMatcher(exceptions.flatMap((entry) => entry.paths));
    const files = input.files.filter(
        (file) => file.kind === 'source' && file.path.endsWith('.md') && !isException(file.path),
    );
    const known = knownPaths(input);
    const projects = Map.groupBy(files, (file) => scopeOf(file.path, input.scopeEntries).path);
    return [...projects].flatMap(([scope, sources]) => {
        const index: PathIndex = { known, tasks: taskSources(input, scope), isException };
        return sources.flatMap((file) =>
            proseLines(readSource(input.root, file.path, input.reads).toString('utf8')).flatMap((prose) =>
                lineFindings(input, file.path, prose, index),
            ),
        );
    });
}

/**
 * One finding per scope without a README.md, and one when the root has no license file.
 * @param input the check input
 * @returns the findings
 */
export function readmePresent(input: CheckInput): Finding[] {
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
        !readdirSync(input.root).some((name) => LICENSE_FILE.test(name) && statSync(join(input.root, name)).isFile())
    )
        findings.push(findingAt(input, { file: 'LICENSE' }, 'missing-license', 'The root has no LICENSE file.'));
    return findings;
}

/**
 * The shape findings for every README in the check's files.
 * @param input the check input
 * @returns the findings
 */
export function readmeShape(input: CheckInput): Finding[] {
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
            const findings = [
                ...openingFindings(input, file.path, nodes),
                ...sectionFindings(input, file.path, nodes, threshold),
            ];
            if (roots.has(file.path)) {
                const sections = nodes.filter((node) => node.type === 'heading' && node.depth === SECTION_DEPTH);
                if (sections.every((node) => START_WORDS.every((word) => !toString(node).toLowerCase().includes(word))))
                    findings.push(
                        findingAt(
                            input,
                            { file: file.path, line: 1 },
                            'start-section',
                            `Add a section whose heading names ${START_WORDS.join(', ')}.`,
                        ),
                    );
            }
            return findings;
        });
}

/**
 * One finding per heading that matches the banned list or [docs] banned_headings.
 * @param input the check input
 * @returns the findings
 */
export function headings(input: CheckInput): Finding[] {
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
