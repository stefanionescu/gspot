import { join, posix } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { statSync, readdirSync } from 'node:fs';
import type { Session } from '#cli/types/tools.ts';
import { TRAILING_SLASH } from '#cli/config/system.ts';
import { find, read } from '#cli/system/files/reads.ts';
import { LEADING_DOT_SLASH } from '#cli/config/engine.ts';
import { pyprojectSchema } from '#cli/schemas/parsers.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/programs.ts';
import { parseMiseTasks } from '#cli/parsers/projects/mise.ts';
import { formatScope, escapeRegExp } from '#cli/system/text.ts';
import { listCodeFences } from '#cli/parsers/formats/markdown.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { joinScope, selectScopePath } from '#cli/repository/scopes.ts';
import { readScalarSetting } from '#cli/engine/tool-runs/placeholders.ts';
import { buildGitignoreMatcher } from '#cli/repository/files/gitignore.ts';
import { listWorkspaceFolders } from '#cli/repository/javascript/workspaces.ts';
import { LICENSE_FILE, SETTING_PLACEHOLDER } from '#cli/config/repository/files.ts';
import { PACKAGE_JSON, PYPROJECT_TOML, WHITESPACE_RUN } from '#cli/config/parsers.ts';
import type { PathIndex, TaskNames, ProseLine } from '#cli/types/configurations/general.ts';
import { listExecutableNames, includeParentFolders, listEnclosingFolders } from '#cli/system/paths.ts';

import {
    BUN_RUN,
    MISE_RUN,
    MISE_FILES,
    DOCS_RULES,
    README_FILE,
    RUN_COMMAND,
    LICENSE_PATH,
    CHANGELOG_FILE,
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
    MISE_TASK_FOLDERS,
    INLINE_LINK_TARGET,
    MARKDOWN_EXTENSIONS,
    TRAILING_PUNCTUATION,
    VERSION_STRING_MESSAGE,
    RELATIVE_PATH_PREFIXES,
    MISSING_LICENSE_MESSAGE,
} from '#cli/config/configurations/general.ts';

function listGeneratorPaths(planned: PlannedCheck): string[] {
    const paths: string[] = [];
    const generatorOutputs = planned.scope.configurations.flatMap((configuration) =>
        configuration.checks.flatMap((check) => check.generator_outputs ?? []),
    );
    for (const output of generatorOutputs) {
        if (output.kind === 'pattern') continue;
        const path = output.path.replaceAll(SETTING_PLACEHOLDER, (_placeholder, name: string) =>
            readScalarSetting(planned.scope.settings, name),
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
        const found = readPackageJson(session.cache, posix.join(path, PACKAGE_JSON));
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
            rule: DOCS_RULES.missingReadme,
            message: `The scope ${formatScope(planned.scope.path)} has no README.md.`,
        });
    if (
        planned.scope.path === '' &&
        ![...repositoryPaths].some((path) => !path.includes('/') && LICENSE_FILE.test(path))
    )
        findings.push({
            file: LICENSE_PATH,
            rule: DOCS_RULES.missingLicense,
            message: MISSING_LICENSE_MESSAGE,
        });
    return findings;
}

function listScopeVersions(session: Session, scopePath: string): string[] {
    return session.repository.files
        .map((file) => file.path)
        .filter((path) => selectScopePath(path, session.scopes) === scopePath)
        .flatMap((path) => {
            const name = posix.basename(path);
            if (name === PACKAGE_JSON) return [readPackageJson(session.cache, path)?.['version']];
            return name === PYPROJECT_TOML
                ? [parseTomlFile(path, read(session.cache, path), pyprojectSchema).project?.version]
                : [];
        })
        .filter((version): version is string => typeof version === 'string');
}

/**
Reports the version of a package manifest of the scope in Markdown and test files, except changelogs.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function checkVersionStrings(session: Session, planned: PlannedCheck): CheckFinding[] {
    const versions = listScopeVersions(session, planned.scope.path);
    if (versions.length === 0) return [];
    const copied = new RegExp(
        String.raw`(?<![\w.])(?:${versions.map((version) => escapeRegExp(version)).join('|')})(?![\w.])`,
        'u',
    );
    const isTest = buildPathMatcher(planned.scope.settings.test_files);
    return planned.files
        .filter(({ path, tags }) => (tags.includes('markdown') || isTest(path)) && !CHANGELOG_FILE.test(path))
        .flatMap(({ path }) =>
            read(session.cache, path)
                .split('\n')
                .flatMap((text, index) => (copied.test(text) ? [index + 1] : []))
                .map((line) => ({ file: path, line, rule: DOCS_RULES.versionString, message: VERSION_STRING_MESSAGE })),
        );
}
