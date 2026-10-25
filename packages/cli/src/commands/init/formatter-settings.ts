import { posix } from 'node:path';
import { DIGITS_ONLY } from '#cli/config/text.ts';
import { findText } from '#cli/system/files/reads.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { parseFileFields } from '#cli/system/errors.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code/python.ts';
import { FORMAT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { ruffFormatSchema, prettierSettingsSchema } from '#cli/schemas/commands.ts';
import { PYTHON_FILES } from '#cli/config/generation/configurations/language/python.ts';
import { DEFAULT_QUOTES } from '#cli/config/generation/configurations/general/format.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import type { SettingsDraft, PrettierOptions, EditorconfigSection } from '#cli/types/commands/init.ts';

import {
    PRETTIER_DEFAULTS,
    EDITORCONFIG_FILE,
    RUFF_SETTINGS_FILES,
    PRETTIER_SCRIPT_FILE,
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
        const text = findText(root, file);
        const quotes = text === undefined ? undefined : parseQuoteStyle(file, text);
        if (quotes !== undefined) return quotes;
    }
    return undefined;
}

function convertPrettierFormat(options: PrettierOptions): TomlTable {
    const indent = options.useTabs === true ? 'tab' : 'space';
    const indentStyle = options.useTabs === undefined ? undefined : indent;
    return stripUndefined({
        indent_style: indentStyle,
        indent_width: options.tabWidth,
        print_width: options.printWidth,
        quotes: convertQuotes(options.singleQuote),
        semicolons: options.semi,
        trailing_commas: options.trailingComma,
    });
}

function buildFormatOverrides(
    options: PrettierOptions | null,
    scope: { root: string; quotes: string | undefined; hasPython: boolean },
): TomlTable[] {
    const prettier = (options?.overrides ?? []).map((override) =>
        stripUndefined({
            paths: (Array.isArray(override.files) ? override.files : [override.files]).map((glob) =>
                glob.includes('/') ? glob : `**/${glob}`,
            ),
            ...convertPrettierFormat(override.options),
        }),
    );
    const python = scope.hasPython ? (readPythonQuotes(scope.root) ?? DEFAULT_QUOTES.ruff) : undefined;
    const pythonOverride =
        python === undefined || python === (scope.quotes ?? DEFAULT_QUOTES.ruff)
            ? []
            : [{ paths: [...PYTHON_FILES], quotes: python }];
    return [...prettier, ...pythonOverride].filter((override) => Object.keys(override).length > 1);
}

function parseEditorWidths(fields: Record<string, string>): PrettierOptions {
    const width = fields['indent_size'] === 'tab' ? fields['tab_width'] : fields['indent_size'];
    const tabWidth = width === undefined || !DIGITS_ONLY.test(width) ? undefined : Number(width);
    const lineWidth = fields['max_line_length'];
    const printWidth = lineWidth === undefined || !DIGITS_ONLY.test(lineWidth) ? undefined : Number(lineWidth);
    const useTabs = fields['indent_style'] === undefined ? undefined : fields['indent_style'] === 'tab';
    return stripUndefined({ tabWidth, printWidth, useTabs });
}

function parseEditorconfigSections(text: string): EditorconfigSection[] {
    const sections: EditorconfigSection[] = [];
    let fields: Record<string, string> | undefined;
    for (const line of text.split(/\r?\n/u)) {
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
    const text = findText(folder, EDITORCONFIG_FILE);
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

function parsePrettierFile(path: string, text: string): PrettierOptions {
    if (PRETTIER_SCRIPT_FILE.test(path)) return {};
    const format = PRETTIER_FILE_FORMATS[posix.basename(path)];
    const parsers = { yaml: parseYamlFile, json: parseJsonFile, toml: parseTomlFile };
    const options = format === undefined ? {} : parsers[format](path, text);
    return { ...PRETTIER_DEFAULTS, ...stripUndefined(parseFileFields(path, options, prettierSettingsSchema)) };
}

function readFormatOptions(
    root: string,
    scope: string,
    dependencies: Record<string, string>,
    prettierFiles: string[],
): PrettierOptions | null {
    const folder = posix.join(root, scope);
    const packagePath = posix.join(scope, PACKAGE_JSON);
    const packageJson = findText(folder, PACKAGE_JSON);
    const packageOptions = packageJson === undefined ? undefined : parseJsonFile(packagePath, packageJson)['prettier'];
    const prettierFile = prettierFiles
        .map((path) => ({ path, text: findText(folder, path) }))
        .find((read): read is { path: string; text: string } => read.text !== undefined);
    const usesPrettier =
        prettierFile !== undefined || packageOptions !== undefined || dependencies['prettier'] !== undefined;
    if (usesPrettier) {
        if (prettierFile !== undefined)
            return parsePrettierFile(posix.join(scope, prettierFile.path), prettierFile.text);
        const options = isTable(packageOptions) ? packageOptions : {};
        return {
            ...PRETTIER_DEFAULTS,
            ...stripUndefined(parseFileFields(packagePath, options, prettierSettingsSchema)),
        };
    }
    return readEditorconfig(folder);
}

function readScopeFormat(
    scope: string,
    selected: Configuration[],
    init: {
        draft: SettingsDraft;
        repository: Repository;
    },
): TomlTable {
    const { draft, repository } = init;
    const format = selected.find((configuration) => configuration.name === FORMAT_CONFIGURATION);
    if (format === undefined) return {};
    const options = readFormatOptions(
        repository.root,
        scope,
        Object.fromEntries(
            repository.dependencyFiles
                .filter((dependencyFile) => findScopeFolder(dependencyFile.path, draft.scopes).path === scope)
                .flatMap((dependencyFile) => Object.entries(dependencyFile.dependencies)),
        ),
        getTool([format], 'prettier').replace as string[],
    );
    const quotes = convertQuotes(options?.singleQuote);
    const hasPython = repository.files.some(
        (file) => file.path.endsWith(PYTHON_EXTENSION) && findScopeFolder(file.path, draft.scopes).path === scope,
    );
    const overrides = buildFormatOverrides(options, { root: posix.join(repository.root, scope), quotes, hasPython });
    if (options === null) return overrides.length === 0 ? {} : { format: { override: overrides } };
    const fields = stripUndefined({
        ...convertPrettierFormat(options),
        override: overrides.length === 0 ? undefined : overrides,
    });
    return Object.keys(fields).length === 0 ? {} : { format: fields };
}

/**
Read the formatting options for each scope that init sets up.

@param scopes the selected configurations for each scope.
@param draft the configurations and the template.
@param repository the root and the tracked files.
@returns the formatting tables, with the template values kept.
*/
export function readFormatTables(
    scopes: { scope: string; selected: Configuration[] }[],
    draft: SettingsDraft,
    repository: Repository,
): Map<string, TomlTable> {
    const context = { draft, repository };
    return new Map(
        scopes.map(({ scope, selected }): [string, TomlTable] => [scope, readScopeFormat(scope, selected, context)]),
    );
}
