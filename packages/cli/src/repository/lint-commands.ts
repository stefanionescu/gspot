import { posix } from 'node:path';

import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import {
    BIN_FOLDER_PREFIX,
    COMMAND_FILES,
    COMMAND_KEYS,
    COMMAND_SEPARATORS,
    COMMENT_LINE,
    FORMAT_SCRIPT,
    HOOK_FOLDER_PATH,
    HOOK_ID_SEPARATOR,
    LINT_COMMAND_FIXES,
    LINT_STAGED_KEY,
    MISE_RUNNER,
    MISE_TASK_FOLDER,
    MISE_TASKS_KEY,
    OTHER_FORMATTER_MESSAGE,
    OVERLAPPING_TOOLS,
    PRE_COMMIT_TOOL,
    PYGREP_LANGUAGE,
    QUOTE_MARK,
    RUN_WORD,
    RUNNER_NAMES,
    SIMPLE_GIT_HOOKS_KEY,
    TASK_AFTER_RUN,
    TASK_NAME_SEPARATOR,
    YAML_EXTENSIONS,
} from '#cli/config/repository/setup.ts';
import { LINE_BREAK } from '#cli/config/system.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlDocuments, parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { hasToolSection, parseSharedFile } from '#cli/repository/conflicts.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { lintCommandPackageSchema, preCommitConfigSchema } from '#cli/schemas/repository.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import type {
    CommandSearch,
    LintCommand,
    LintCommandPackage,
    LintCommandPlace,
    LintCommandSearch,
} from '#cli/types/repository.ts';

function findCalledTool(command: string, search: CommandSearch, seen = new Set<string>()): string | undefined {
    const words = command
        .split(COMMAND_SEPARATORS)
        .filter((word) => word !== '')
        .map((word) => word.replace(BIN_FOLDER_PREFIX, ''));
    const direct = words.find((word) => search.tools.has(word));
    if (direct !== undefined) return direct;
    const called = words.flatMap((word, index) => {
        if (!RUNNER_NAMES.includes(word)) return [];
        const next = words[index + 1];
        const task = (next === RUN_WORD ? words[index + TASK_AFTER_RUN] : next) ?? '';
        const body = (word === MISE_RUNNER ? search.miseTasks : search.scripts).get(task);
        return body === undefined ? [] : [body];
    });
    return called
        .filter((body) => !seen.has(body))
        .map((body) => findCalledTool(body, search, seen.add(body)))
        .find((tool) => tool !== undefined);
}

function buildRow(place: LintCommandPlace, command: string, search: CommandSearch, words = command): LintCommand[] {
    const tool = findCalledTool(words, search);
    if (tool === undefined) return [];
    return [
        {
            file: place.file,
            line: findLine(place.text, command.trim()),
            source: place.source,
            command: command.trim(),
            tool,
            fix: LINT_COMMAND_FIXES[place.source],
        },
    ];
}

function listDocumentCommands(value: unknown, keys: ReadonlySet<string>): string[] {
    if (Array.isArray(value)) return value.flatMap((each) => listDocumentCommands(each, keys));
    if (!isTable(value)) return [];
    return Object.entries(value).flatMap(([key, child]) =>
        keys.has(key)
            ? [child].flat().filter((each): each is string => typeof each === 'string')
            : listDocumentCommands(child, keys),
    );
}

function parseCommandDocuments({ file, text }: LintCommandPlace): unknown[] | undefined {
    const extension = posix.extname(file);
    return tryParseFile(() =>
        YAML_EXTENSIONS.includes(extension) ? parseYamlDocuments(file, text) : [parseSharedFile(text, extension, file)],
    );
}

function parseDocumentRows(place: LintCommandPlace, search: CommandSearch): LintCommand[] {
    const documents = parseCommandDocuments(place);
    return listDocumentCommands(documents, COMMAND_KEYS).flatMap((command) =>
        command.split(LINE_BREAK).flatMap((line) => buildRow(place, line, search)),
    );
}

function parsePreCommitRows(place: LintCommandPlace, search: CommandSearch): LintCommand[] {
    const config = tryParseFile(() => parseYamlFile(place.file, place.text, preCommitConfigSchema));
    const lines = place.text.split(LINE_BREAK);
    let start = 0;
    return (config?.repos ?? [])
        .flatMap(({ hooks }) => hooks)
        .flatMap(({ id, entry, language }) => {
            const line = lines.findIndex((text, index) => index >= start && text.includes('id:') && text.includes(id));
            start = line + 1;
            if (language === PYGREP_LANGUAGE) return [];
            const words = `${id.split(HOOK_ID_SEPARATOR)[0] ?? id} ${entry ?? ''}`;
            return buildRow(place, entry ?? id, search, words).map((row) => ({ ...row, line: start }));
        });
}

function parseLineRows(place: LintCommandPlace, search: CommandSearch): LintCommand[] {
    return place.text
        .split(LINE_BREAK)
        .filter((line) => !COMMENT_LINE.test(line))
        .flatMap((line) => buildRow(place, line, search, line.replaceAll(QUOTE_MARK, ' ')));
}

function listMiseRunCommands(place: LintCommandPlace): Array<[name: string, commands: string[]]> {
    const [document] = parseCommandDocuments(place) ?? [];
    const tasks = isTable(document) ? document[MISE_TASKS_KEY] : undefined;
    return Object.entries(isTable(tasks) ? tasks : {}).map(([name, task]) => [
        name,
        [isTable(task) ? task[RUN_WORD] : undefined].flat().filter((each): each is string => typeof each === 'string'),
    ]);
}

/**
List the mise tasks by the name that `mise run` takes, each with the commands it runs. A file task takes its name from
its path below the tasks folder, without the extension, and a task in mise.toml from its table.
*/
function readMiseTasks(places: LintCommandPlace[]): Map<string, string> {
    return new Map(
        places
            .filter(({ source }) => source === 'mise-task')
            .flatMap((place): Array<[string, string]> => {
                if (!MISE_TASK_FOLDER.test(place.file))
                    return listMiseRunCommands(place).map(([name, commands]) => [name, commands.join('\n')]);
                const { dir, name } = posix.parse(place.file.replace(MISE_TASK_FOLDER, ''));
                const lines = place.text.split(LINE_BREAK).filter((line) => !COMMENT_LINE.test(line));
                return [
                    [
                        posix.join(dir, name).replaceAll('/', () => TASK_NAME_SEPARATOR),
                        lines.join('\n').replaceAll(QUOTE_MARK, ' '),
                    ],
                ];
            }),
    );
}

function parseMiseTaskRows(place: LintCommandPlace, search: CommandSearch): LintCommand[] {
    if (MISE_TASK_FOLDER.test(place.file)) return parseLineRows(place, search);
    return listMiseRunCommands(place)
        .flatMap(([, commands]) => commands)
        .flatMap((command) => command.split(LINE_BREAK).flatMap((line) => buildRow(place, line, search)));
}

function readRootPackage(root: string): { text: string; manifest: LintCommandPackage['manifest'] } | undefined {
    const text = findText(root, PACKAGE_JSON);
    if (text === undefined) return undefined;
    const manifest = tryParseFile(() => parseJsonFile(PACKAGE_JSON, text, lintCommandPackageSchema));
    return manifest === undefined ? undefined : { text, manifest };
}

function readDependencyRows({ root, pins }: LintCommandSearch): LintCommand[] {
    const rootPackage = readRootPackage(root);
    if (rootPackage === undefined) return [];
    const { text, manifest } = rootPackage;
    return Object.entries(manifest.devDependencies).flatMap(([name, version]) => {
        const shipped = pins[name];
        if (shipped === undefined) return [];
        return [
            {
                file: PACKAGE_JSON,
                line: findLine(text, `"${name}"`, findLine(text, '"devDependencies"')),
                source: 'dependency' as const,
                command: `${name} ${version}, and gspot pins ${shipped}`,
                tool: name,
                fix: LINT_COMMAND_FIXES.dependency,
            },
        ];
    });
}

function readOverlappingToolRows({ root, files, tools }: LintCommandSearch): LintCommand[] {
    const settings = { source: 'settings', fix: LINT_COMMAND_FIXES.settings } as const;
    const tracked = new Set(files.map(({ path }) => path));
    return OVERLAPPING_TOOLS.filter(({ owner }) => tools.has(owner)).flatMap(({ name, files: own, sections }) => [
        ...own
            .filter((file) => tracked.has(file))
            .map((file) => ({ ...settings, file, line: 1, command: file, tool: name })),
        ...sections.flatMap(([file, table]) => {
            const text = tracked.has(file) ? findText(root, file) : undefined;
            return text === undefined || !hasToolSection(text, file, { table })
                ? []
                : [{ ...settings, file, line: findLine(text, `[${table}`), command: `[${table}]`, tool: name }];
        }),
    ]);
}

function readPlaces({ root, files }: Pick<LintCommandSearch, 'root' | 'files'>): LintCommandPlace[] {
    const paths = files.filter((file) => file.kind === 'source' && !isGspotPath(file.path));
    return paths.flatMap(({ path: file }) => {
        const source = COMMAND_FILES.find(({ path }) => path.test(file))?.source;
        const text = source === undefined ? undefined : findText(root, file);
        return source === undefined || text === undefined ? [] : [{ file, text, source }];
    });
}

function listPackageRows({ place, manifest }: LintCommandPackage, search: CommandSearch): LintCommand[] {
    const hook = { ...place, source: 'hook' } as const;
    return [
        ...Object.values(manifest.scripts).flatMap((command) => buildRow(place, command, search)),
        ...Object.values(manifest[SIMPLE_GIT_HOOKS_KEY]).flatMap((command) => buildRow(hook, command, search)),
    ];
}

export function findLine(text: string, needle: string, from = 1): number {
    const lines = text.split(LINE_BREAK);
    const index = lines.findIndex((line, lineIndex) => lineIndex >= from - 1 && line.includes(needle));
    return index === -1 ? from : index + 1;
}

/**
List the format scripts of the root package that call a tool gspot does not know. It stays out of listLintCommands,
because a row there fails a commit, and gspot cannot tell what such a tool formats.
*/
export function listOtherFormatScripts(input: Pick<LintCommandSearch, 'root' | 'files' | 'tools'>): LintCommand[] {
    const { root, tools } = input;
    const rootPackage = readRootPackage(root);
    if (rootPackage === undefined) return [];
    const { text, manifest } = rootPackage;
    const search = {
        tools,
        scripts: new Map(Object.entries(manifest.scripts)),
        miseTasks: readMiseTasks(readPlaces(input)),
    };
    return Object.entries(manifest.scripts)
        .filter(([name, command]) => FORMAT_SCRIPT.test(name) && findCalledTool(command, search) === undefined)
        .map(([name, command]) => ({
            file: PACKAGE_JSON,
            line: findLine(text, `"${name}"`),
            source: 'script' as const,
            command,
            tool: name,
            fix: OTHER_FORMATTER_MESSAGE,
        }));
}

/**
List the CI files that do not parse. listLintCommands gives them no row, because a row there fails the commit of a
user, so the init plan names them instead.
*/
export function listUnparsedCiFiles(input: Pick<LintCommandSearch, 'root' | 'files'>): string[] {
    return readPlaces(input)
        .filter((place) => place.source === 'ci' && parseCommandDocuments(place) === undefined)
        .map(({ file }) => file);
}

/**
List each place in the user's repository that still runs or configures a tool that gspot now runs. These places are
package scripts, lint-staged entries, hook lines, pre-commit entries, CI steps, and mise tasks that reach such a tool.
The list also holds root devDependencies that gspot pins too, and the settings files and sections of tools that a gspot
tool covers.
*/
export function listLintCommands(input: LintCommandSearch): LintCommand[] {
    const places = readPlaces(input);
    const packages = places
        .filter(({ source }) => source === 'script')
        .flatMap((place) => {
            const manifest = tryParseFile(() => parseJsonFile(place.file, place.text, lintCommandPackageSchema));
            return manifest === undefined ? [] : [{ place, manifest }];
        });
    const scripts = new Map(packages.flatMap(({ manifest }) => Object.entries(manifest.scripts)));
    const search = { ...input, scripts, miseTasks: readMiseTasks(places) };
    const staged = [
        ...packages.flatMap(({ place, manifest }) => {
            const keyLine = findLine(place.text, `"${LINT_STAGED_KEY}"`);
            return manifest[LINT_STAGED_KEY].flatMap((command) =>
                buildRow({ ...place, source: 'lint-staged' }, command, search).map((row) => ({
                    ...row,
                    line: findLine(place.text, row.command, keyLine),
                })),
            );
        }),
        ...places.filter(({ source }) => source === 'lint-staged').flatMap((place) => parseLineRows(place, search)),
    ];
    const preCommit = places
        .filter(({ source }) => source === 'pre-commit')
        .flatMap((place) => parsePreCommitRows(place, search));
    const wide = {
        ...search,
        tools: new Set([
            ...input.tools,
            ...(staged.length > 0 ? [LINT_STAGED_KEY] : []),
            ...(preCommit.length > 0 ? [PRE_COMMIT_TOOL] : []),
        ]),
    };
    return [
        ...packages.flatMap((each) => listPackageRows(each, wide)),
        ...staged,
        ...preCommit,
        ...places
            .filter(({ source }) => source === 'hook' || source === 'ci')
            .flatMap((place) =>
                HOOK_FOLDER_PATH.test(place.file) ? parseLineRows(place, wide) : parseDocumentRows(place, wide),
            ),
        ...places.filter(({ source }) => source === 'mise-task').flatMap((place) => parseMiseTaskRows(place, wide)),
        ...readDependencyRows(input),
        ...readOverlappingToolRows(input),
    ];
}
