import { posix } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { findText } from '#cli/system/files/reads.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { LINE_BREAK, PACKAGE_JSON } from '#cli/config/parsers.ts';
import { parseYamlDocuments } from '#cli/parsers/formats/yaml.ts';
import { lintCommandPackageSchema } from '#cli/schemas/repository.ts';
import { hasToolSection, parseSharedFile } from '#cli/repository/conflicts.ts';

import type {
    LintCommand,
    CommandSearch,
    LintCommandPlace,
    LintCommandSearch,
    LintCommandPackage,
} from '#cli/types/repository.ts';
import {
    RUN_WORD,
    QUOTE_MARK,
    COMMENT_LINE,
    COMMAND_KEYS,
    RUNNER_NAMES,
    SECOND_TOOLS,
    COMMAND_FILES,
    TASK_AFTER_RUN,
    PRE_COMMIT_KEYS,
    PRE_COMMIT_TOOL,
    LINT_STAGED_KEY,
    YAML_EXTENSIONS,
    HOOK_FOLDER_PATH,
    HOOK_ID_SEPARATOR,
    BIN_FOLDER_PREFIX,
    LINT_COMMAND_FIXES,
    COMMAND_SEPARATORS,
    SIMPLE_GIT_HOOKS_KEY,
} from '#cli/config/repository/setup.ts';

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
        .map((task) => findCalledTool(search.scripts.get(task) as string, search, seen.add(task)))
        .find((tool) => tool !== undefined);
}

function findLine(text: string, needle: string): number {
    const lines = text.split(LINE_BREAK);
    const index = lines.findIndex((line) => line.includes(needle));
    return Math.max(index + 1, 1);
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

function readDocumentRows(place: LintCommandPlace, search: CommandSearch): LintCommand[] {
    const { file, text, source } = place;
    const extension = posix.extname(file);
    const documents = YAML_EXTENSIONS.includes(extension)
        ? parseYamlDocuments(file, text)
        : [parseSharedFile(text, extension, file)];
    if (source === 'pre-commit')
        return listDocumentCommands(documents, PRE_COMMIT_KEYS).flatMap((command) =>
            buildRow(place, command, search, command.replaceAll(HOOK_ID_SEPARATOR, ' ')),
        );
    return listDocumentCommands(documents, COMMAND_KEYS).flatMap((command) =>
        command.split(LINE_BREAK).flatMap((line) => buildRow(place, line, search)),
    );
}

function readLineRows(place: LintCommandPlace, search: CommandSearch): LintCommand[] {
    return place.text
        .split(LINE_BREAK)
        .filter((line) => !COMMENT_LINE.test(line))
        .flatMap((line) => buildRow(place, line, search, line.replaceAll(QUOTE_MARK, ' ')));
}

function readDependencyRows({ root, pins }: LintCommandSearch): LintCommand[] {
    const text = findText(root, PACKAGE_JSON);
    if (text === undefined) return [];
    const { devDependencies } = parseJsonFile(PACKAGE_JSON, text, lintCommandPackageSchema);
    return Object.entries(devDependencies).flatMap(([name, version]) => {
        const shipped = pins[name];
        if (shipped === undefined) return [];
        return [
            {
                file: PACKAGE_JSON,
                line: findLine(text, `"${name}"`),
                source: 'dependency' as const,
                command: `${name} ${version}, and gspot pins ${shipped}`,
                tool: name,
                fix: LINT_COMMAND_FIXES.dependency,
            },
        ];
    });
}

function readSecondToolRows({ root, files, tools }: LintCommandSearch): LintCommand[] {
    const settings = { source: 'settings', fix: LINT_COMMAND_FIXES.settings } as const;
    const tracked = new Set(files.map(({ path }) => path));
    return SECOND_TOOLS.filter(({ owner }) => tools.has(owner)).flatMap(({ name, files: own, sections }) => [
        ...own
            .filter((file) => tracked.has(file))
            .map((file) => ({ ...settings, file, line: 1, command: file, tool: name })),
        ...sections.flatMap(([file, table]) => {
            const text = tracked.has(file) ? findText(root, file) : undefined;
            if (text === undefined || !hasToolSection(text, file, { table })) return [];
            return [{ ...settings, file, line: findLine(text, `[${table}`), command: `[${table}]`, tool: name }];
        }),
    ]);
}

function readPlaces({ root, files }: LintCommandSearch): LintCommandPlace[] {
    const paths = files.filter((file) => file.kind === 'source' && !isGspotPath(file.path));
    return paths.flatMap(({ path: file }) => {
        const source = COMMAND_FILES.find(({ path }) => path.test(file))?.source;
        const text = source === undefined ? undefined : findText(root, file);
        return source === undefined || text === undefined ? [] : [{ file, text, source }];
    });
}

function readPackageRows({ place, manifest }: LintCommandPackage, search: CommandSearch): LintCommand[] {
    const hook = { ...place, source: 'hook' } as const;
    return [
        ...Object.values(manifest.scripts).flatMap((command) => buildRow(place, command, search)),
        ...Object.values(manifest[SIMPLE_GIT_HOOKS_KEY]).flatMap((command) => buildRow(hook, command, search)),
    ];
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
        .map((place) => ({ place, manifest: parseJsonFile(place.file, place.text, lintCommandPackageSchema) }));
    const scripts = new Map(packages.flatMap(({ manifest }) => Object.entries(manifest.scripts)));
    const search = { ...input, scripts };
    const staged = [
        ...packages.flatMap(({ place, manifest }) =>
            Object.values(manifest[LINT_STAGED_KEY])
                .flat()
                .flatMap((command) => buildRow({ ...place, source: 'lint-staged' }, command, search)),
        ),
        ...places.filter(({ source }) => source === 'lint-staged').flatMap((place) => readLineRows(place, search)),
    ];
    const preCommit = places
        .filter(({ source }) => source === 'pre-commit')
        .flatMap((place) => readDocumentRows(place, search));
    const wide = {
        ...search,
        tools: new Set([
            ...input.tools,
            ...(staged.length > 0 ? [LINT_STAGED_KEY] : []),
            ...(preCommit.length > 0 ? [PRE_COMMIT_TOOL] : []),
        ]),
    };
    return [
        ...packages.flatMap((each) => readPackageRows(each, wide)),
        ...staged,
        ...preCommit,
        ...places
            .filter(({ source }) => source === 'hook' || source === 'ci')
            .flatMap((place) =>
                HOOK_FOLDER_PATH.test(place.file) ? readLineRows(place, wide) : readDocumentRows(place, wide),
            ),
        ...readDependencyRows(input),
        ...readSecondToolRows(input),
    ];
}
