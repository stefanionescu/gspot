import { join, posix } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { statSync, readdirSync } from 'node:fs';
import { WHITESPACE_RUN } from '#cli/config/text.ts';
import type { Session } from '#cli/types/session.ts';
import { find, read } from '#cli/system/files/reads.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { parseMiseTasks } from '#cli/parsers/projects/mise.ts';
import { listCodeFences } from '#cli/parsers/formats/markdown.ts';
import { NPM_BIN_FOLDER } from '#cli/config/executables/locate.ts';
import { TRAILING_SLASH } from '#cli/config/files/path-patterns.ts';
import { LEADING_DOT_SLASH } from '#cli/config/runs/output/text.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { joinScope, selectScopePath } from '#cli/repository/scopes.ts';
import { LICENSE_FILE } from '#cli/config/repository/files/classify.ts';
import { readCachedPackageJson } from '#cli/repository/dependencies.ts';
import { listWorkspaceFolders } from '#cli/repository/npm/workspaces.ts';
import { MISE_FILES, MISE_TASK_FOLDERS } from '#cli/config/files/names.ts';
import { buildGitignoreMatcher } from '#cli/repository/files/gitignore.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { replaceSettingPlaceholders } from '#cli/runs/command/placeholders.ts';
import type { PathIndex, TaskNames, ProseLine } from '#cli/types/checks/general/docs.ts';
import { listExecutableNames, includeParentFolders, listEnclosingFolders } from '#cli/system/paths.ts';

import {
    RULES,
    BUN_RUN,
    MISE_RUN,
    README_FILE,
    RUN_COMMAND,
    LICENSE_PATH,
    COMMAND_FENCES,
    FILE_EXTENSION,
    PATH_CHARACTERS,
    MISE_CONF_FILES,
    CODE_SPAN_START,
    TITLE_ATTRIBUTE,
    EMPHASIS_MARKERS,
    PATH_TOKEN_SKIPS,
    REMOTE_ARGUMENTS,
    TOKEN_SEPARATORS,
    INLINE_LINK_TARGET,
    MARKDOWN_EXTENSIONS,
    TRAILING_PUNCTUATION,
    RELATIVE_PATH_PREFIXES,
    MISSING_LICENSE_MESSAGE,
} from '#cli/config/checks/general/docs.ts';

function listGeneratorPaths(planned: PlannedCheck): string[] {
    const paths: string[] = [];
    const generatorOutputs = planned.scope.configurations.flatMap((configuration) =>
        configuration.checks.flatMap((check) => check.generator_outputs ?? []),
    );
    for (const output of generatorOutputs) {
        if (output.kind === 'pattern') continue;
        const path = replaceSettingPlaceholders(planned.scope.settings, output.path);
        if (path !== '') paths.push(path);
    }
    return paths;
}

function listRepositoryPaths(session: Session, planned: PlannedCheck): Set<string> {
    const repositoryPaths = includeParentFolders(session.repository.files.map((file) => file.path));
    const generatedPaths = includeParentFolders([...listGeneratedPaths(session.repository.files)]);
    for (const path of generatedPaths) repositoryPaths.add(path);
    const configFiles = planned.scope.configurations.flatMap((configuration) => configuration.configFiles);
    for (const configFile of configFiles) repositoryPaths.add(configFile.target);
    for (const path of listGeneratorPaths(planned)) repositoryPaths.add(path);
    const checks = session.configurationsByName.values().flatMap((configuration) => configuration.checks);
    for (const check of checks) repositoryPaths.add(check.id);
    for (const check of Object.values(session.settings.commandChecks)) repositoryPaths.add(check.id);
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
            rule: RULES.missingPath,
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
            rule: RULES.missingTask,
            message: `${match[0]} names no task or script.`,
        }))
        .toArray();
    return [...paths, ...runs];
}

function listPackageBinaries(session: Session, folders: string[]): string[] {
    return folders.flatMap((folder) => {
        const manifest = readCachedPackageJson(session.cache, posix.join(folder, PACKAGE_JSON));
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
            ancestors.flatMap(({ path }) => [
                ...MISE_FILES.map((file) => posix.join(path, file)),
                ...session.repository.files
                    .map(({ path }) => path)
                    .filter(buildPathMatcher([posix.join(path, MISE_CONF_FILES)])),
            ]),
        ),
    ];
    let scripts: string[] = [];
    let packages: string[] = [];
    for (const { path } of ancestors) {
        const found = readCachedPackageJson(session.cache, posix.join(path, PACKAGE_JSON));
        if (found === undefined) continue;
        scripts = found.scripts === undefined ? [] : Object.keys(found.scripts);
        packages = [path, ...(path === '' ? listWorkspaceFolders(session.root) : [])];
        break;
    }
    return {
        mise: new Set([
            ...files.flatMap((file) => {
                const text = find(session.cache, file);
                return text === undefined ? [] : parseMiseTasks(text, file);
            }),
            ...ancestors.flatMap(({ path }) =>
                MISE_TASK_FOLDERS.flatMap((taskFolder) => {
                    const folder = posix.join(path, taskFolder);
                    return session.repository.files
                        .map(({ path }) => path)
                        .filter(buildPathMatcher([`${folder}/**`]))
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

function extractProseLines(text: string): ProseLine[] {
    const ignored = new Set<number>();
    const commands = new Set<number>();
    for (const fence of listCodeFences(text)) {
        const titled = fence.attributes
            .split(WHITESPACE_RUN)
            .some((attribute) => attribute.startsWith(TITLE_ATTRIBUTE));
        for (let line = fence.startLine; line <= fence.endLine; line += 1) {
            if (titled || [fence.startLine, fence.endLine].includes(line) || !COMMAND_FENCES.has(fence.language))
                ignored.add(line);
            else commands.add(line);
        }
    }
    return text
        .split('\n')
        .flatMap((line, index) =>
            ignored.has(index + 1) ? [] : { number: index + 1, text: line, command: commands.has(index + 1) },
        );
}

function extractPathTokens(line: string): string[] {
    let text = line.replaceAll(INLINE_LINK_TARGET, (match) => (match.startsWith(CODE_SPAN_START) ? match : ''));
    for (const pattern of REMOTE_ARGUMENTS) text = text.replaceAll(pattern, '');
    return text
        .split(TOKEN_SEPARATORS)
        .map((token) => {
            let end = token.length;
            while (end > 0 && TRAILING_PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
            return token.slice(0, end);
        })
        .map((token) => {
            const marker = EMPHASIS_MARKERS.find((marker) => token.startsWith(marker));
            return marker !== undefined && token.endsWith(marker) ? token.slice(marker.length, -marker.length) : token;
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
export function checkMissingPaths(session: Session, planned: PlannedCheck): CheckFinding[] {
    const files = planned.files.filter(
        (file) => file.kind === 'source' && MARKDOWN_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    const repositoryPaths = listRepositoryPaths(session, planned);
    const isIgnored = buildGitignoreMatcher(
        session.cache,
        session.repository.files.map((file) => file.path),
    );
    const projects = Map.groupBy(files, (file) => selectScopePath(file.path, session.repository.scopeFolders));
    return [...projects].flatMap(([scope, sources]) => {
        const index: PathIndex = { paths: repositoryPaths, isIgnored, tasks: readTaskNames(session, scope) };
        return sources.flatMap((file) => {
            const text = read(session.cache, file.path);
            return extractProseLines(text).flatMap((prose) => validateProseLine(file.path, prose, index));
        });
    });
}

/**
Reports a scope without a README.md, and a root without a license file.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export function checkRequiredFiles(session: Session, planned: PlannedCheck): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const repositoryPaths = new Set(session.repository.files.map(({ path }) => path));
    const readme = joinScope(planned.scope.path, README_FILE);
    if (!repositoryPaths.has(readme))
        findings.push({
            file: readme,
            rule: RULES.missingReadme,
            message: `The scope ${planned.scope.path === '' ? ROOT_SCOPE_LABEL : planned.scope.path} has no README.md.`,
        });
    if (
        planned.scope.path === '' &&
        ![...repositoryPaths].some((path) => !path.includes('/') && LICENSE_FILE.test(path))
    )
        findings.push({
            file: LICENSE_PATH,
            rule: RULES.missingLicense,
            message: MISSING_LICENSE_MESSAGE,
        });
    return findings;
}
