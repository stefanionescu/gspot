import { join, posix } from 'node:path';
import { statSync, readdirSync } from 'node:fs';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { parseMiseTasks } from '#cli/parsers/mise.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { listCodeFences } from '#cli/parsers/markdown.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { TRAILING_SLASH } from '#cli/config/system/paths.ts';
import { LEADING_DOT_SLASH } from '#cli/config/runs/output.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { MISE_FILES } from '#cli/config/checks/dependencies.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/inspection.ts';
import { findScope, joinScope } from '#cli/repository/scopes.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import { LICENSE_FILE } from '#cli/config/repository/inventory.ts';
import type { PathIndex, TaskNames } from '#cli/types/checks/docs.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { buildGitignoreTest } from '#cli/repository/files/gitignore.ts';
import { readCachedPackageJson } from '#cli/repository/dependency-files.ts';
import { findCachedText, readCachedText } from '#cli/system/files/reads.ts';
import { listExecutableNames, includeParentFolders, listEnclosingFolders } from '#cli/system/paths.ts';

import {
    BUN_RUN,
    MISE_RUN,
    PATH_CHARS,
    README_FILE,
    RUN_COMMAND,
    LICENSE_PATH,
    COMMAND_FENCES,
    FILE_EXTENSION,
    MISE_CONF_FILES,
    TITLE_ATTRIBUTE,
    EMPHASIS_MARKERS,
    PATH_TOKEN_SKIPS,
    TOKEN_SEPARATORS,
    MISE_TASKS_FOLDER,
    MARKDOWN_EXTENSIONS,
    TRAILING_PUNCTUATION,
    RELATIVE_PATH_PREFIXES,
} from '#cli/config/checks/docs.ts';

function listGeneratorPaths(planned: PlannedCheck): string[] {
    const paths: string[] = [];
    const generatorOutputs = planned.selection.selected.flatMap((configuration) =>
        configuration.checks.flatMap((check) => check.generator_outputs ?? []),
    );
    for (const output of generatorOutputs) {
        if (output.kind === 'pattern') continue;
        const path = output.path.replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
            const value = planned.selection.view.settings[name];
            return typeof value === 'string' ? value : '';
        });
        if (path !== '') paths.push(path);
    }
    return paths;
}

function listKnownPaths(session: Session, planned: PlannedCheck): Set<string> {
    const known = includeParentFolders(session.repository.files.map((file) => file.path));
    for (const path of includeParentFolders([...listGeneratedPaths(session.repository.files)])) known.add(path);
    for (const toolFile of planned.selection.selected.flatMap((configuration) => configuration.toolFiles))
        known.add(toolFile.target);
    for (const path of listGeneratorPaths(planned)) known.add(path);
    // A check ID such as postgres/migration-order looks like a path, so count it as known.
    for (const check of session.configurations.values().flatMap((configuration) => configuration.checks))
        known.add(check.name);
    for (const check of Object.values(session.settingsFile.settings.commandChecks)) known.add(check.name);
    return known;
}

function readMiseTasks(session: Session, file: string): string[] {
    const text = findCachedText(session.reads, file);
    if (text === undefined) return [];
    return parseMiseTasks(text, file);
}

function isMissing(token: string, file: string, index: PathIndex): boolean {
    const clean = token.replace(LEADING_DOT_SLASH, '').replace(TRAILING_SLASH, '');
    const relative = posix.normalize(posix.join(posix.dirname(file), clean));
    if (index.known.has(relative) || [relative, clean].some((path) => index.isIgnored(path))) return false;
    if (RELATIVE_PATH_PREFIXES.some((prefix) => token.startsWith(prefix))) return true;
    const first = clean.split('/', 1)[0] ?? '';
    return !index.known.has(clean) && (index.known.has(first) || (!first.includes('.') && FILE_EXTENSION.test(clean)));
}

function checkProseLine(planned: PlannedCheck, file: string, prose: NumberedLine, index: PathIndex): Finding[] {
    const { number, text: line } = prose;
    const paths = extractPathTokens(line)
        .filter((token) => isMissing(token, file, index))
        .map((token) =>
            buildFinding(planned, { file, line: number }, 'missing-path', `${token} names no tracked file or folder.`),
        );
    const runs = line
        .matchAll(RUN_COMMAND)
        .filter((match) => {
            const command = match[0];
            const names = command.startsWith(MISE_RUN) ? index.tasks.mise : index.tasks.scripts;
            const name = command.slice(command.lastIndexOf(' ') + 1);
            if (names.has(name)) return false;
            return (
                !command.startsWith(BUN_RUN) ||
                !listExecutableNames(name).some((binary) => index.tasks.binaries.has(binary))
            );
        })
        .map((match) =>
            buildFinding(planned, { file, line: number }, 'missing-task', `${match[0]} names no task or script.`),
        )
        .toArray();
    return [...paths, ...runs];
}

function readTaskNames(session: Session, scope: string): TaskNames {
    const ancestors = listEnclosingFolders(scope).flatMap((folder) =>
        session.repository.scopeFolders.filter((entry) => entry.path === folder),
    );
    const files = [
        ...new Set(
            ancestors.flatMap(({ path }) => [
                ...MISE_FILES.map((file) => posix.join(path, file)),
                ...session.repository.files
                    .map(({ path }) => path)
                    .filter(buildPathMatcher([posix.join(path, MISE_CONF_FILES)])),
            ]),
        ),
    ];
    let scripts: string[] = [];
    for (const { path } of ancestors) {
        const found = readCachedPackageJson(session.reads, posix.join(path, PACKAGE_JSON));
        if (found === undefined) continue;
        scripts = found.scripts === undefined ? [] : Object.keys(found.scripts);
        break;
    }
    return {
        mise: new Set([
            ...files.flatMap((file) => readMiseTasks(session, file)),
            ...ancestors.flatMap(({ path }) => {
                const folder = posix.join(path, MISE_TASKS_FOLDER);
                return session.repository.files
                    .map(({ path }) => path)
                    .filter(buildPathMatcher([`${folder}/**`]))
                    .map((file) => posix.relative(folder, file).replaceAll('/', ':'));
            }),
        ]),
        scripts: new Set(scripts),
        binaries: new Set(
            ancestors.flatMap(({ path }) => {
                const folder = join(session.root, path, NPM_BIN_FOLDER);
                return statSync(folder, { throwIfNoEntry: false })?.isDirectory() === true ? readdirSync(folder) : [];
            }),
        ),
    };
}

/**
 * Lists prose lines and the lines of untitled command blocks, with line numbers.
 *
 * @param text the Markdown source.
 * @returns the lines a path check reads.
 */
function extractProseLines(text: string): NumberedLine[] {
    const ignored = new Set<number>();
    for (const fence of listCodeFences(text)) {
        const titled = fence.meta.split(/\s+/u).some((attribute) => attribute.startsWith(TITLE_ATTRIBUTE));
        for (let line = fence.startLine; line <= fence.endLine; line += 1)
            if ([fence.startLine, fence.endLine].includes(line) || !COMMAND_FENCES.has(fence.language) || titled)
                ignored.add(line);
    }
    return text
        .split('\n')
        .flatMap((line, index) => (ignored.has(index + 1) ? [] : [{ number: index + 1, text: line }]));
}

/**
 * Lists the words of a line that look like paths.
 *
 * @param line the prose to scan.
 * @returns the path-like words without trailing punctuation and emphasis marks.
 */
function extractPathTokens(line: string): string[] {
    return line
        .split(TOKEN_SEPARATORS)
        .map((token) => {
            let end = token.length;
            while (end > 0 && TRAILING_PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
            return token.slice(0, end);
        })
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
 * Reports each path that names no tracked file, and each run command that names no task.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose Markdown files to read.
 * @returns the findings.
 */
export function checkDocsMissingPaths(session: Session, planned: PlannedCheck): Finding[] {
    const files = planned.files.filter(
        (file) => file.kind === 'source' && MARKDOWN_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    const known = listKnownPaths(session, planned);
    const isIgnored = buildGitignoreTest(
        session.reads,
        session.repository.files.map((file) => file.path),
    );
    const projects = Map.groupBy(files, (file) => findScope(file.path, session.repository.scopeFolders).path);
    return [...projects].flatMap(([scope, sources]) => {
        const index: PathIndex = { known, isIgnored, tasks: readTaskNames(session, scope) };
        return sources.flatMap((file) => {
            const text = readCachedText(session.reads, file.path);
            return extractProseLines(text).flatMap((prose) => checkProseLine(planned, file.path, prose, index));
        });
    });
}

/**
 * Reports a scope without a README.md, and a root without a license file.
 *
 * @param session the repository and its tools.
 * @param planned the scope to search.
 * @returns the findings.
 */
export function checkDocsRequiredFiles(session: Session, planned: PlannedCheck): Finding[] {
    const findings: Finding[] = [];
    const repositoryPaths = new Set(session.repository.files.map(({ path }) => path));
    const readme = joinScope(planned.selection.scope.path, README_FILE);
    if (!repositoryPaths.has(readme))
        findings.push(
            buildFinding(
                planned,
                { file: readme },
                'missing-readme',
                `The scope ${planned.selection.scope.path === '' ? ROOT_SCOPE_LABEL : planned.selection.scope.path} has no README.md.`,
            ),
        );
    if (
        planned.selection.scope.path === '' &&
        ![...repositoryPaths].some((path) => !path.includes('/') && LICENSE_FILE.test(path))
    )
        findings.push(
            buildFinding(planned, { file: LICENSE_PATH }, 'missing-license', 'The root has no LICENSE file.'),
        );
    return findings;
}
