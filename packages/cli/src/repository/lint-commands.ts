import { posix } from 'node:path';

import { LINE_BREAK, PACKAGE_JSON } from '#cli/config/parsers.ts';
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
    OTHER_FORMATTER_MESSAGE,
    OVERLAPPING_TOOLS,
    PRE_COMMIT_TOOL,
    PYGREP_LANGUAGE,
    QUOTE_MARK,
    RUN_WORD,
    RUNNER_NAMES,
    SIMPLE_GIT_HOOKS_KEY,
    TASK_AFTER_RUN,
    YAML_EXTENSIONS,
} from '#cli/config/repository/setup.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlDocuments, parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { hasToolSection, parseSharedFile } from '#cli/repository/conflicts.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { lintCommandPackageSchema, preCommitConfigSchema } from '#cli/schemas/repository.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { getRequired, isTable } from '#cli/system/tables.ts';
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
    const tasks = words.flatMap((word, index) => {
        if (!RUNNER_NAMES.includes(word)) return [];
        const next = words[index + 1];
        return [(next === RUN_WORD ? words[index + TASK_AFTER_RUN] : next) ?? ''];
    });
    const called = tasks.filter((task) => search.scripts.has(task) && !seen.has(task));
    return called
        .map((task) => findCalledTool(getRequired(search.scripts, task, 'script'), search, seen.add(task)))
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

function readPreCommitRows(place: LintCommandPlace, search: CommandSearch): LintCommand[] {
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

function readDependencyRows({ root, pins }: LintCommandSearch): LintCommand[] {
    const text = findText(root, PACKAGE_JSON);
    if (text === undefined) return [];
    const manifest = tryParseFile(() => parseJsonFile(PACKAGE_JSON, text, lintCommandPackageSchema));
    if (manifest === undefined) return [];
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

/**
Find the line of a text in a file, for an instruction that a person follows by its line number.

@param text the file text.
@param needle what the line holds.
@param from the first line to search.
@returns the line, or `from` when no line holds it.
*/
export function findLine(text: string, needle: string, from = 1): number {
    const lines = text.split(LINE_BREAK);
    const index = lines.findIndex((line, lineIndex) => lineIndex >= from - 1 && line.includes(needle));
    return index === -1 ? from : index + 1;
}

/**
List the format scripts of the root package that call a tool gspot does not know. It stays out of listLintCommands,
because a row there fails a commit, and gspot cannot tell what such a tool formats.

@param input what the search reads.
@param input.root the repository root.
@param input.tools the replaced tools.
*/
export function listOtherFormatScripts({ root, tools }: Pick<LintCommandSearch, 'root' | 'tools'>): LintCommand[] {
    const text = findText(root, PACKAGE_JSON);
    if (text === undefined) return [];
    const manifest = tryParseFile(() => parseJsonFile(PACKAGE_JSON, text, lintCommandPackageSchema));
    if (manifest === undefined) return [];
    const scripts = new Map(Object.entries(manifest.scripts));
    return Object.entries(manifest.scripts)
        .filter(
            ([name, command]) => FORMAT_SCRIPT.test(name) && findCalledTool(command, { tools, scripts }) === undefined,
        )
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

@param input the repository root and its tracked files.
@returns the path of each file.
*/
export function listUnparsedCiFiles(input: Pick<LintCommandSearch, 'root' | 'files'>): string[] {
    return readPlaces(input)
        .filter((place) => place.source === 'ci' && parseCommandDocuments(place) === undefined)
        .map(({ file }) => file);
}

/**
List what calls or repeats a tool that gspot replaces. The list holds package scripts, lint-staged entries, hook lines,
pre-commit entries, and CI steps. It also holds root devDependencies that gspot installs too, and the settings of the
tools that a replaced tool covers.

@param input the repository, the replaced tools, and their pins.
@returns one row per place, each with the line to delete or to replace.
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
    const search = { ...input, scripts };
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
        .flatMap((place) => readPreCommitRows(place, search));
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
        ...readDependencyRows(input),
        ...readOverlappingToolRows(input),
    ];
}
