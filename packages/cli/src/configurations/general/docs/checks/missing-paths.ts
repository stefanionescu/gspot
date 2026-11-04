import { join, posix } from 'node:path';
import { visit } from 'unist-util-visit';
import { isTable } from '#cli/system/tables.ts';
import { statSync, readdirSync } from 'node:fs';
import type { Session } from '#cli/types/tools.ts';
import { TRAILING_SLASH } from '#cli/config/system.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { LEADING_DOT_SLASH } from '#cli/config/engine.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/programs.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { PACKAGE_JSON, WHITESPACE_RUN } from '#cli/config/parsers.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/repository/files.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { getScalarSetting } from '#cli/engine/tool-runs/placeholders.ts';
import { parseMiseTasks } from '#cli/configurations/general/docs/mise.ts';
import { buildGitignoreMatcher } from '#cli/repository/files/gitignore.ts';
import { listWorkspaceFolders } from '#cli/repository/javascript/workspaces.ts';
import type { PathIndex, TaskNames, ProseLine } from '#cli/types/configurations/general.ts';
import { MISSING_PATH_EXPLANATIONS } from '#cli/configurations/general/docs/explanations.ts';
import { escapeGlob, listExecutableNames, includeParentFolders, listEnclosingFolders } from '#cli/system/paths.ts';

import {
    BUN_RUN,
    MISE_RUN,
    MISE_FILES,
    DOCS_RULES,
    RUN_COMMAND,
    COMMAND_FENCES,
    FILE_EXTENSION,
    PATH_CHARACTERS,
    TITLE_ATTRIBUTE,
    MISE_CONFIG_GLOB,
    PATH_TOKEN_SKIPS,
    REMOTE_ARGUMENTS,
    TOKEN_SEPARATORS,
    MISE_TASK_FOLDERS,
    MARKDOWN_EXTENSIONS,
    TRAILING_PUNCTUATION,
    RELATIVE_PATH_PREFIXES,
} from '#cli/config/configurations/general.ts';

function listGeneratorPaths(planned: PlannedCheck): string[] {
    const paths: string[] = [];
    const generatorOutputs = planned.scope.configurations.flatMap((configuration) =>
        configuration.checks.flatMap((check) => check.generator_outputs ?? []),
    );
    for (const output of generatorOutputs) {
        if (output.kind === 'pattern') continue;
        const path = output.path.replaceAll(SETTING_PLACEHOLDER, (_placeholder, name: string) =>
            getScalarSetting(planned.scope.settings, name),
        );
        if (path !== '') paths.push(path);
    }
    return paths;
}

function listRepositoryPaths(session: Session, planned: PlannedCheck): Set<string> {
    const repositoryPaths = includeParentFolders(session.repository.files.map((file) => file.path));
    const generatedPaths = includeParentFolders([...listGeneratedPaths(session.repository.files)]);
    for (const path of generatedPaths) repositoryPaths.add(path);
    const configs = planned.scope.configurations.flatMap((configuration) => configuration.configs);
    for (const config of configs) repositoryPaths.add(config.target);
    for (const path of listGeneratorPaths(planned)) repositoryPaths.add(path);
    // A check ID reads like a path, such as docs/lychee, and a document may name it.
    const checkNames = [
        ...readConfigurations()
            .values()
            .flatMap((configuration) => configuration.checks),
        ...Object.values(session.settings.commandChecks),
    ].map((check) => check.id);
    for (const name of checkNames) repositoryPaths.add(name);
    return repositoryPaths;
}

function isMissing(token: string, file: string, index: PathIndex): boolean {
    const clean = token.replace(LEADING_DOT_SLASH, '').replace(TRAILING_SLASH, '');
    const relative = posix.normalize(posix.join(posix.dirname(file), clean));
    if (index.paths.has(relative) || [relative, clean].some((path) => index.isIgnored(path))) return false;
    if (RELATIVE_PATH_PREFIXES.some((prefix) => token.startsWith(prefix))) return true;
    const first = clean.split('/', 1)[0] ?? '';
    return !index.paths.has(clean) && (index.paths.has(first) || (!first.includes('.') && FILE_EXTENSION.test(clean)));
}

function validateProseLine(file: string, prose: ProseLine, index: PathIndex): CheckFinding[] {
    const { number, text: line } = prose;
    const paths = extractPathTokens(line)
        .filter((token) => !prose.command || !posix.normalize(token).startsWith('../'))
        .filter((token) => isMissing(token, prose.command ? '' : file, index))
        .map((token) => ({
            file,
            line: number,
            rule: DOCS_RULES.missingPath,
            message: `${token} names no tracked file or folder.`,
        }));
    const runs = line
        .matchAll(RUN_COMMAND)
        .filter((match) => {
            const command = match[0];
            const names = command.startsWith(MISE_RUN) ? index.tasks.mise : index.tasks.scripts;
            const name = command.slice(command.lastIndexOf(' ') + 1);
            if (names.has(name) || (command.startsWith(BUN_RUN) && (name.includes('/') || FILE_EXTENSION.test(name))))
                return false;
            return (
                !command.startsWith(BUN_RUN) ||
                listExecutableNames(name).every((binary) => !index.tasks.binaries.has(binary))
            );
        })
        .map((match) => ({
            file,
            line: number,
            rule: DOCS_RULES.missingTask,
            message: `${match[0]} names no task or script.`,
        }))
        .toArray();
    return [...paths, ...runs];
}

function listPackageBinaries(session: Session, folders: string[]): string[] {
    return folders.flatMap((folder) => {
        const manifest = readPackageJson(session.cache, posix.join(folder, PACKAGE_JSON));
        const bin = manifest?.['bin'];
        if (typeof bin === 'string') {
            const name = manifest?.name?.split('/').at(-1);
            return name === undefined ? [] : [name];
        }
        return isTable(bin) ? Object.keys(bin).filter((name) => typeof bin[name] === 'string') : [];
    });
}

function readTaskNames(session: Session, scopePath: string): TaskNames {
    const ancestors = listEnclosingFolders(scopePath).flatMap((folder) =>
        session.repository.scopeFolders.filter((scopeFolder) => scopeFolder.path === folder),
    );
    const files = [
        ...new Set(
            ancestors.flatMap(({ path }) => {
                const isMiseConfig = buildPathMatcher([posix.join(escapeGlob(path), MISE_CONFIG_GLOB)]);
                return [
                    ...MISE_FILES.map((file) => posix.join(path, file)),
                    ...session.repository.files.map(({ path }) => path).filter((path) => isMiseConfig(path)),
                ];
            }),
        ),
    ];
    let scripts: string[] = [];
    let packages: string[] = [];
    for (const { path } of ancestors) {
        const found = readPackageJson(session.cache, posix.join(path, PACKAGE_JSON));
        if (found === undefined) continue;
        scripts = found.scripts === undefined ? [] : Object.keys(found.scripts);
        packages = [path, ...(path === '' ? listWorkspaceFolders(session.root) : [])];
        break;
    }
    return {
        mise: new Set([
            ...files.flatMap((file) => {
                const text = findText(session.cache, file);
                return text === undefined ? [] : parseMiseTasks(text, file);
            }),
            ...ancestors.flatMap(({ path }) =>
                MISE_TASK_FOLDERS.flatMap((taskFolder) => {
                    const folder = posix.join(path, taskFolder);
                    return session.repository.files
                        .map(({ path }) => path)
                        .filter(buildPathMatcher([`${escapeGlob(folder)}/**`]))
                        .map((file) => {
                            const relative = posix.relative(folder, file);
                            return (
                                posix.basename(relative) === '_default' ? posix.dirname(relative) : relative
                            ).replaceAll('/', ':');
                        });
                }),
            ),
        ]),
        scripts: new Set(scripts),
        binaries: new Set([
            ...listPackageBinaries(session, packages),
            ...ancestors.flatMap(({ path }) => {
                const folder = join(session.root, path, NPM_BIN_FOLDER);
                return statSync(folder, { throwIfNoEntry: false })?.isDirectory() === true ? readdirSync(folder) : [];
            }),
        ]),
    };
}

function isCommandFence(language: string | null | undefined, written: string | null | undefined): boolean {
    const attributes = (written ?? '').split(WHITESPACE_RUN);
    return (
        COMMAND_FENCES.has(language ?? '') && attributes.every((attribute) => !attribute.startsWith(TITLE_ATTRIBUTE))
    );
}

function extractProseLines(text: string): ProseLine[] {
    const lines: ProseLine[] = [];
    const addLines = (value: string, position: { start: { line: number } } | undefined, isFenced: boolean): void => {
        const first = (position?.start.line ?? 1) + (isFenced ? 1 : 0);
        for (const [index, line] of value.split('\n').entries())
            lines.push({ number: first + index, text: line, command: isFenced });
    };
    visit(fromMarkdown(text), (node) => {
        if (node.type === 'code' && isCommandFence(node.lang, node.meta)) addLines(node.value, node.position, true);
        else if (node.type === 'definition') addLines(node.url, node.position, false);
        else if (node.type === 'text' || node.type === 'inlineCode') addLines(node.value, node.position, false);
    });
    return lines;
}

function extractPathTokens(line: string): string[] {
    let text = line;
    for (const pattern of REMOTE_ARGUMENTS) text = text.replaceAll(pattern, '');
    return text
        .split(TOKEN_SEPARATORS)
        .map((token) => {
            let end = token.length;
            while (end > 0 && TRAILING_PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
            return token.slice(0, end);
        })
        .filter(
            (token) =>
                token.includes('/') &&
                PATH_CHARACTERS.test(token) &&
                PATH_TOKEN_SKIPS.every((skip) => !skip.test(token)),
        );
}

/**
Reports each path that names no tracked file, and each run command that names no task.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
function checkMissingPaths(session: Session, planned: PlannedCheck): CheckFinding[] {
    const files = planned.files.filter(
        (file) => file.kind === 'source' && MARKDOWN_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    const repositoryPaths = listRepositoryPaths(session, planned);
    const isIgnored = buildGitignoreMatcher(
        session.cache,
        session.repository.files.map((file) => file.path),
    );
    const projects = Map.groupBy(files, (file) => selectScopePath(file.path, session.repository.scopeFolders));
    return [...projects].flatMap(([scopePath, sources]) => {
        const index: PathIndex = { paths: repositoryPaths, isIgnored, tasks: readTaskNames(session, scopePath) };
        return sources.flatMap((file) => {
            const text = readText(session.cache, file.path);
            return extractProseLines(text).flatMap((prose) => validateProseLine(file.path, prose, index));
        });
    });
}

export const DOCS_MISSING_PATHS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docs/missing-paths': { check: checkMissingPaths, explanations: MISSING_PATH_EXPLANATIONS },
};
