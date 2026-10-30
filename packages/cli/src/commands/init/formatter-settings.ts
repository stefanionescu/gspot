import { posix } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { find } from '#cli/system/files/reads.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { LINE_BREAK, DIGITS_ONLY } from '#cli/config/text.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';
import { FORMAT_CONFIGURATION } from '#cli/config/manifests/names.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code/python.ts';
import { PRETTIER_SCRIPT_FILE } from '#cli/config/commands/init/prettier.ts';
import { ruffFormatSchema, prettierSettingsSchema } from '#cli/schemas/commands.ts';
import { PYTHON_FILES } from '#cli/config/generation/configurations/language/python.ts';
import { DEFAULT_QUOTES } from '#cli/config/generation/configurations/general/format.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';

import type {
    SettingsDraft,
    PrettierOptions,
    ScopeConfigurations,
    EditorconfigSection,
} from '#cli/types/commands/init.ts';
import {
    PRETTIER_DEFAULTS,
    EDITORCONFIG_FILE,
    RUFF_SETTINGS_FILES,
    EDITORCONFIG_SECTION,
    EDITORCONFIG_COMMENT,
    PRETTIER_FILE_FORMATS,
} from '#cli/config/commands/init/formatter-settings.ts';

function convertQuotes(singleQuote: boolean | undefined): 'single' | 'double' | undefined {
    if (singleQuote === undefined) return undefined;
    return singleQuote ? 'single' : 'double';
}

function parseQuoteStyle(file: string, text: string): string | undefined {
    const parsed = parseTomlFile(file, text, ruffFormatSchema);
    const format = file === PYPROJECT_TOML ? parsed.tool?.ruff?.format : parsed.format;
    return format?.['quote-style'];
}

function readPythonQuotes(root: string): string | undefined {
    for (const file of RUFF_SETTINGS_FILES) {
        const text = find(root, file);
        const quotes = text === undefined ? undefined : parseQuoteStyle(file, text);
        if (quotes !== undefined) return quotes;
    }
    return undefined;
}

function convertPrettierFormat(options: PrettierOptions): TomlTable {
    const indent = options.useTabs === true ? 'tab' : 'space';
    const indentStyle = options.useTabs === undefined ? undefined : indent;
    return {
        indent_style: indentStyle,
        indent_width: options.tabWidth,
        print_width: options.printWidth,
        quotes: convertQuotes(options.singleQuote),
        semicolons: options.semi,
        trailing_commas: options.trailingComma,
    };
}

function buildFormatOverrides(
    options: PrettierOptions | null,
    scope: { root: string; quotes: string | undefined; hasPython: boolean },
): TomlTable[] {
    const prettier = (options?.overrides ?? []).map((override) => ({
        paths: (Array.isArray(override.files) ? override.files : [override.files]).map((glob) =>
            glob.includes('/') ? glob : `**/${glob}`,
        ),
        ...convertPrettierFormat(override.options),
    }));
    const python = scope.hasPython ? (readPythonQuotes(scope.root) ?? DEFAULT_QUOTES.ruff) : undefined;
    const pythonOverride =
        python === undefined || python === (scope.quotes ?? DEFAULT_QUOTES.ruff)
            ? []
            : [{ paths: [...PYTHON_FILES], quotes: python }];
    return [...prettier, ...pythonOverride].filter(
        (override: TomlTable) => Object.values(override).filter((value) => value !== undefined).length > 1,
    );
}

function parseEditorWidths(fields: Record<string, string>): PrettierOptions {
    const width = fields['indent_size'] === 'tab' ? fields['tab_width'] : fields['indent_size'];
    const lineWidth = fields['max_line_length'];
    const options: PrettierOptions = {};
    if (width !== undefined && DIGITS_ONLY.test(width)) options.tabWidth = Number(width);
    if (lineWidth !== undefined && DIGITS_ONLY.test(lineWidth)) options.printWidth = Number(lineWidth);
    if (fields['indent_style'] !== undefined) options.useTabs = fields['indent_style'] === 'tab';
    return options;
}

function parseEditorconfigSections(text: string): EditorconfigSection[] {
    const sections: EditorconfigSection[] = [];
    let fields: Record<string, string> | undefined;
    for (const line of text.split(LINE_BREAK)) {
        if (EDITORCONFIG_COMMENT.test(line)) continue;
        const section = EDITORCONFIG_SECTION.exec(line);
        if (section !== null) {
            const files = section[1] as string;
            fields = {};
            sections.push({ files, fields });
            continue;
        }
        const equal = line.indexOf('=');
        if (fields !== undefined && equal !== -1) fields[line.slice(0, equal).trim()] = line.slice(equal + 1).trim();
    }
    return sections;
}

function readEditorconfig(folder: string): PrettierOptions | null {
    const text = find(folder, EDITORCONFIG_FILE);
    if (text === undefined) return null;
    const sections = parseEditorconfigSections(text);
    const project = Object.fromEntries(
        sections.filter(({ files }) => files === '*').flatMap(({ fields }) => Object.entries(fields)),
    );
    return {
        ...parseEditorWidths(project),
        overrides: sections
            .filter(({ files }) => files !== '*')
            .map(({ files, fields }) => ({ files, options: parseEditorWidths(fields) })),
    };
}

/**
Read static Prettier options without running JavaScript.

@param path the config file.
@param text its contents.
@returns the options, or undefined when the file needs another parser.
*/
export function parsePrettierFile(path: string, text: string): PrettierOptions | undefined {
    if (PRETTIER_SCRIPT_FILE.test(path)) return undefined;
    const format = PRETTIER_FILE_FORMATS[posix.basename(path)];
    const parsers = { yaml: parseYamlFile, json: parseJsonFile, toml: parseTomlFile };
    let options: unknown;
    try {
        options = format === undefined ? {} : parsers[format](path, text);
    } catch (error) {
        if (path.endsWith('.json5') && error instanceof GspotError) return undefined;
        throw error;
    }
    return parseFileFields(path, options, prettierSettingsSchema);
}

function readFormatOptions(
    root: string,
    scopePath: string,
    dependencies: Record<string, string>,
    prettierFiles: string[],
): PrettierOptions | null {
    const folder = posix.join(root, scopePath);
    const editorconfig = readEditorconfig(folder);
    const packagePath = posix.join(scopePath, PACKAGE_JSON);
    const packageJson = find(folder, PACKAGE_JSON);
    const packageOptions = packageJson === undefined ? undefined : parseJsonFile(packagePath, packageJson)['prettier'];
    const prettierFile = prettierFiles
        .filter((path) => path !== '.prettierignore')
        .map((path) => ({ path, text: find(folder, path) }))
        .find((read): read is { path: string; text: string } => read.text !== undefined);
    const usesPrettier =
        prettierFile !== undefined || packageOptions !== undefined || dependencies['prettier'] !== undefined;
    if (!usesPrettier) return editorconfig;
    const packageFields = isTable(packageOptions) ? packageOptions : {};
    const options =
        prettierFile === undefined
            ? parseFileFields(packagePath, packageFields, prettierSettingsSchema)
            : parsePrettierFile(posix.join(scopePath, prettierFile.path), prettierFile.text);
    return { ...PRETTIER_DEFAULTS, ...editorconfig, ...options };
}

/**
Read the formatting options of one scope that init sets up.

@param selection the scope and its selected configurations.
@param selection.scope the scope path, empty for the root.
@param selection.selected the configurations selected in the scope.
@param draft the configurations and the template.
@param repository the root and the tracked files.
@returns the formatting table that this scope's formatter files give.
*/
export function readScopeFormat(
    { scope, selected }: ScopeConfigurations,
    draft: SettingsDraft,
    repository: Repository,
): TomlTable {
    const format = selected.find((configuration) => configuration.name === FORMAT_CONFIGURATION);
    if (format === undefined) return {};
    const options = readFormatOptions(
        repository.root,
        scope,
        Object.fromEntries(
            repository.dependencyFiles
                .filter((dependencyFile) => selectScopePath(dependencyFile.path, draft.scopes) === scope)
                .flatMap((dependencyFile) => Object.entries(dependencyFile.dependencies)),
        ),
        getTool([format], 'prettier').replace as string[],
    );
    const quotes = convertQuotes(options?.singleQuote);
    const hasPython = repository.files.some(
        (file) => file.path.endsWith(PYTHON_EXTENSION) && selectScopePath(file.path, draft.scopes) === scope,
    );
    const overrides = buildFormatOverrides(options, { root: posix.join(repository.root, scope), quotes, hasPython });
    if (options === null) return overrides.length === 0 ? {} : { format: { override: overrides } };
    const fields: TomlTable = {
        ...convertPrettierFormat(options),
        ...(overrides.length > 0 && { override: overrides }),
    };
    return Object.values(fields).every((value) => value === undefined) ? {} : { format: fields };
}
