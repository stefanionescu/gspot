import picomatch from 'picomatch';
import { join, posix } from 'node:path';
import { visit } from 'unist-util-visit';
import { readJson } from '#cli/parsers/json.ts';
import { statSync, readdirSync } from 'node:fs';
import { globPaths } from '#cli/system/files.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { parseMiseTasks } from '#cli/parsers/mise.ts';
import { readSource } from '#cli/system/file-reads.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { NPM_BIN_FOLDER } from '#cli/config/tools/find.ts';
import { includeParentFolders } from '#cli/system/paths.ts';
import { TRAILING_SLASH } from '#cli/config/system/paths.ts';
import { executableNames } from '#cli/system/executables.ts';
import { LEADING_DOT_SLASH } from '#cli/config/parsers/output.ts';
import { LICENSE_FILE } from '#cli/config/repository/inventory.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/configurations.ts';
import { packageJsonSchema } from '#cli/parsers/dependency-files.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { scopeOf, isInScope, joinScope } from '#cli/repository/scopes.ts';
import type { PathIndex, TaskSources } from '#cli/types/checks/general.ts';
import { MISE_FILES, RUNNER_NAMES, MISE_TASKS_FOLDER } from '#cli/config/repository/tooling.ts';

import {
    BUN_RUN,
    MISE_RUN,
    PATH_CHARS,
    README_FILE,
    LICENSE_PATH,
    COMMAND_FENCES,
    FILE_EXTENSION,
    TITLE_ATTRIBUTE,
    MISE_CONF_FILES,
    EMPHASIS_MARKERS,
    PATH_TOKEN_SKIPS,
    TOKEN_SEPARATORS,
    TRAILING_PUNCTUATION,
    OPTIONAL_GENERATED_PATHS,
} from '#cli/config/checks/general/docs.ts';

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- reason: This index combines tracked, ignored, generated, and declared paths; splitting it creates one-caller index wrappers.
function knownPaths(input: CheckInput): Set<string> {
    const known = includeParentFolders(input.repositoryFiles.map((file) => file.path));
    for (const path of includeParentFolders([...input.generatedPaths()])) known.add(path);
    for (const path of includeParentFolders([...OPTIONAL_GENERATED_PATHS])) known.add(path);
    for (const manifest of input.selection.selected)
        for (const toolFile of manifest.toolFiles) known.add(toolFile.target);
    const outputs = input.selection.selected.flatMap((manifest) =>
        manifest.checks.flatMap((check) => check.generated_paths ?? []),
    );
    for (const output of outputs) {
        if (output.kind === 'pattern') continue;
        const path = output.path.replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
            const value = input.selection.view.settings[name];
            return typeof value === 'string' ? value : '';
        });
        if (path !== '') known.add(path);
    }
    const ignored = input.repositoryFiles
        .filter((file) => posix.basename(file.path) === '.gitignore')
        .flatMap((file) =>
            readSource(input.root, file.path, input.reads)
                .toString('utf8')
                .split('\n')
                .map((line) => line.trim())
                .filter(
                    (line) =>
                        line !== '' && !line.startsWith('#') && !line.startsWith('!') && !picomatch.scan(line).isGlob,
                )
                .map((line) =>
                    posix.join(posix.dirname(file.path), line.replace(/^\//u, '').replace(TRAILING_SLASH, '')),
                ),
        );
    for (const path of includeParentFolders(ignored)) known.add(path);
    // Check names resemble paths. A reference to postgres/migration-order identifies that check.
    for (const manifest of input.manifests.values()) for (const check of manifest.checks) known.add(check.name);
    for (const check of Object.values(input.settingsFile.settings.check)) known.add(check.name);
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
        const manifest = readJson(file, readSource(input.root, file, input.reads).toString('utf8'), packageJsonSchema);
        return manifest.scripts === undefined ? [] : Object.keys(manifest.scripts);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw new Error(`Cannot read task definitions from ${file}.`, { cause: error });
    }
}

function isMissing(token: string, file: string, index: PathIndex): boolean {
    const clean = cleanPathToken(token);
    const relative = posix.normalize(posix.join(posix.dirname(file), clean));
    if (index.known.has(relative)) return false;
    if (token.startsWith('./') || token.startsWith('../')) return true;
    const first = clean.split('/', 1)[0] ?? '';
    return !index.known.has(clean) && (index.known.has(first) || (!first.includes('.') && FILE_EXTENSION.test(clean)));
}

function lineFindings(input: CheckInput, file: string, prose: NumberedLine, index: PathIndex): Finding[] {
    const { number, text: line } = prose;
    const paths = pathTokens(line)
        .filter((token) => isMissing(token, file, index))
        .map((token) =>
            findingAt(input, { file, line: number }, 'missing-path', `${token} names no tracked file or folder.`),
        );
    const runToken = new RegExp(String.raw`\b(?:${RUNNER_NAMES.join('|')}) run (?:--[\w-]+\s+)*[\w][\w:.-]*`, 'gu');
    const runs = line
        .matchAll(runToken)
        .filter((match) => {
            const command = match[0];
            const names = command.startsWith(MISE_RUN) ? index.tasks.mise : index.tasks.packages;
            const name = command.slice(command.lastIndexOf(' ') + 1);
            if (names.has(name)) return false;
            return (
                !command.startsWith(BUN_RUN) ||
                !executableNames(name).some((binary) => index.tasks.binaries.has(binary))
            );
        })
        .map((match) =>
            findingAt(input, { file, line: number }, 'missing-task', `${match[0]} names no task or script.`),
        )
        .toArray();
    return [...paths, ...runs];
}

function taskSources(input: CheckInput, scope: string): TaskSources {
    const ancestors = input.scopeEntries
        .filter((entry) => isInScope(scope, entry.path))
        .toSorted((left, right) => right.path.length - left.path.length);
    const files = [
        ...new Set(
            ancestors.flatMap(({ path }) => [
                ...MISE_FILES.filter((file) => file !== '.tool-versions').map((file) => posix.join(path, file)),
                ...globPaths(input.root, posix.join(path, MISE_CONF_FILES)),
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
        mise: new Set([
            ...files.flatMap((file) => miseTasks(input, file)),
            ...ancestors.flatMap(({ path }) => {
                const folder = posix.join(path, MISE_TASKS_FOLDER);
                return globPaths(input.root, posix.join(folder, '**')).map((file) =>
                    posix.relative(folder, file).replaceAll('/', ':'),
                );
            }),
        ]),
        packages: new Set(scripts),
        binaries: new Set(
            ancestors.flatMap(({ path }) => {
                const folder = join(input.root, path, NPM_BIN_FOLDER);
                return statSync(folder, { throwIfNoEntry: false })?.isDirectory() === true ? readdirSync(folder) : [];
            }),
        ),
    };
}

function withoutPunctuation(token: string): string {
    let end = token.length;
    while (end > 0 && TRAILING_PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
    return token.slice(0, end);
}

/**
 * Prose and untitled command bodies, with their numbers.
 * @param text the Markdown text.
 * @returns the lines a path check reads.
 */
function proseLines(text: string): NumberedLine[] {
    const ignored = new Set<number>();
    visit(fromMarkdown(text), 'code', (node) => {
        if (node.position === undefined) return;
        const titled = node.meta?.split(/\s+/u).some((attribute) => attribute.startsWith(TITLE_ATTRIBUTE)) === true;
        const { start, end } = node.position;
        for (let line = start.line; line <= end.line; line += 1)
            if ([start.line, end.line].includes(line) || !COMMAND_FENCES.has(node.lang ?? '') || titled)
                ignored.add(line);
    });
    return text
        .split('\n')
        .flatMap((line, index) => (ignored.has(index + 1) ? [] : [{ number: index + 1, text: line }]));
}

/**
 * The tokens of one line that look like paths.
 * @param line the line.
 * @returns the path tokens.
 */
function pathTokens(line: string): string[] {
    return line
        .split(TOKEN_SEPARATORS)
        .map((token) => withoutPunctuation(token))
        .map((token) => {
            const marker = EMPHASIS_MARKERS.find((marker) => token.startsWith(marker));
            if (marker !== undefined && token.endsWith(marker)) return token.slice(marker.length, -marker.length);
            return token;
        })
        .filter(
            (token) =>
                token.includes('/') && PATH_CHARS.test(token) && PATH_TOKEN_SKIPS.every((skip) => !skip.test(token)),
        );
}

/**
 * Remove an optional current-directory prefix and a trailing directory slash from a prose path token.
 * @param token the authored token.
 * @returns the path used for repository comparisons.
 */
function cleanPathToken(token: string): string {
    return token.replace(LEADING_DOT_SLASH, '').replace(TRAILING_SLASH, '');
}

/**
 * One finding per path token that names nothing tracked and per run invocation that names no task.
 * @param input the check input.
 * @returns the findings.
 */
export function missingPaths(input: CheckInput): Finding[] {
    const files = input.files.filter((file) => file.kind === 'source' && file.path.endsWith('.md'));
    const known = knownPaths(input);
    const projects = Map.groupBy(files, (file) => scopeOf(file.path, input.scopeEntries).path);
    return [...projects].flatMap(([scope, sources]) => {
        const index: PathIndex = { known, tasks: taskSources(input, scope) };
        return sources.flatMap((file) => {
            const text = readSource(input.root, file.path, input.reads).toString('utf8');
            return proseLines(text).flatMap((prose) => lineFindings(input, file.path, prose, index));
        });
    });
}

/**
 * One finding per scope without a README.md, and one when the root has no license file.
 * @param input the check input.
 * @returns the findings.
 */
export function requiredFiles(input: CheckInput): Finding[] {
    const findings: Finding[] = [];
    const readme = joinScope(input.selection.scope.path, README_FILE);
    if (statSync(join(input.root, readme), { throwIfNoEntry: false }) === undefined)
        findings.push(
            findingAt(
                input,
                { file: readme },
                'missing-readme',
                `The scope ${input.selection.scope.path === '' ? 'root' : input.selection.scope.path} has no README.md.`,
            ),
        );
    if (
        input.selection.scope.path === '' &&
        !readdirSync(input.root).some((name) => LICENSE_FILE.test(name) && statSync(join(input.root, name)).isFile())
    )
        findings.push(findingAt(input, { file: LICENSE_PATH }, 'missing-license', 'The root has no LICENSE file.'));
    return findings;
}
