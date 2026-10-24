import { posix } from 'node:path';
import { DIGITS_ONLY } from '#cli/config/text.ts';
import { findText } from '#cli/system/files/reads.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code/python.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/document.ts';
import { buildSelectedConfigurations } from '#cli/commands/init/selection.ts';
import type { SettingsDraft, PrettierOptions } from '#cli/types/commands/init.ts';
import { ruffFormatSchema, prettierSettingsSchema } from '#cli/schemas/commands.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import { PYTHON_FILES } from '#cli/config/generation/configurations/language/python/ruff.ts';
import { DEFAULT_QUOTES } from '#cli/config/generation/configurations/general/format/prettier.ts';

import {
    PRETTIER_DEFAULTS,
    EDITORCONFIG_FILE,
    RUFF_SETTINGS_FILES,
    PRETTIER_SCRIPT_FILE,
    FORMAT_CONFIGURATION,
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

function buildFormatOverrides(
    options: PrettierOptions | null,
    scope: { root: string; quotes: string | undefined; hasPython: boolean },
): TomlTable[] {
    const prettier = (options?.overrides ?? []).map((override) =>
        stripUndefined({
            paths: (Array.isArray(override.files) ? override.files : [override.files]).map((glob) =>
                glob.includes('/') ? glob : `**/${glob}`,
            ),
            indent_width: override.options.tabWidth,
            print_width: override.options.printWidth,
            quotes: convertQuotes(override.options.singleQuote),
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
    return stripUndefined({ tabWidth, printWidth });
}

function readEditorconfig(folder: string): PrettierOptions | null {
    const text = findText(folder, EDITORCONFIG_FILE);
    if (text === undefined) return null;
    const sections: { files: string; fields: Record<string, string> }[] = [];
    let fields: Record<string, string> | undefined;
    for (const line of text.split(/\r?\n/u).filter((line) => !EDITORCONFIG_COMMENT.test(line))) {
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
    return { ...PRETTIER_DEFAULTS, ...stripUndefined(prettierSettingsSchema.parse(options)) };
}

function readFormatOptions(
    file: string,
    dependencies: Record<string, string>,
    prettierFiles: string[],
): PrettierOptions | null {
    const root = posix.dirname(file);
    const packageJson = findText(root, PACKAGE_JSON);
    const packageOptions = packageJson === undefined ? undefined : parseJsonFile(file, packageJson)['prettier'];
    const prettierFile = prettierFiles
        .map((path) => ({ path, text: findText(root, path) }))
        .find((read): read is { path: string; text: string } => read.text !== undefined);
    const usesPrettier =
        prettierFile !== undefined || packageOptions !== undefined || dependencies['prettier'] !== undefined;
    if (usesPrettier) {
        if (prettierFile !== undefined)
            return parsePrettierFile(posix.join(root, prettierFile.path), prettierFile.text);
        const options = isTable(packageOptions) ? packageOptions : {};
        return { ...PRETTIER_DEFAULTS, ...stripUndefined(prettierSettingsSchema.parse(options)) };
    }
    return readEditorconfig(root);
}

function readScopeFormat(
    scope: string,
    init: {
        draft: SettingsDraft;
        repository: Repository;
        configurations: Map<string, Configuration>;
    },
): TomlTable {
    const { draft, repository, configurations } = init;
    const selected = selectForScope(buildSelectedConfigurations(draft), scope, configurations);
    const format = selected.find((configuration) => configuration.name === FORMAT_CONFIGURATION);
    if (format === undefined) return {};
    const options = readFormatOptions(
        posix.join(repository.root, scope, PACKAGE_JSON),
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
        indent_width: options.tabWidth,
        print_width: options.printWidth,
        quotes,
        override: overrides.length === 0 ? undefined : overrides,
    });
    return Object.keys(fields).length === 0 ? {} : { format: fields };
}

/**
 * Read the formatting options for each scope that init sets up.
 *
 * @param draft the configurations and the template.
 * @param repository the root and the tracked files.
 * @param configurations every configuration.
 * @returns the formatting tables, with the template values kept.
 */
export function readFormatTables(
    draft: SettingsDraft,
    repository: Repository,
    configurations: Map<string, Configuration>,
): Map<string, TomlTable> {
    const context = { draft, repository, configurations };
    return new Map(
        ['', ...draft.scopes.map((scope) => scope.path)].map((scope): [string, TomlTable] => [
            scope,
            readScopeFormat(scope, context),
        ]),
    );
}
