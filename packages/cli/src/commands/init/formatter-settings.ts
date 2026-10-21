import { posix } from 'node:path';
import { DIGITS_ONLY } from '#cli/config/text.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { selectForScope } from '#cli/settings/scope-view.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { parseTomlFile } from '#cli/parsers/toml/document.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/python.ts';
import { isRecord, stripUndefined } from '#cli/system/tables.ts';
import { DEFAULT_QUOTES } from '#cli/config/settings/defaults.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { FORMAT_CONFIGURATION } from '#cli/config/configurations.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { buildDraftSelection } from '#cli/commands/init/selection.ts';
import { PYTHON_FILES } from '#cli/config/generation/settings/builders/ruff.ts';
import type { SettingsDraft, PrettierOptions } from '#cli/types/commands/init.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/dependencies.ts';
import { ruffFormatSchema, prettierSettingsSchema } from '#cli/schemas/commands.ts';

import {
    EDITORCONFIG_FILE,
    PRETTIER_DEFAULTS,
    RUFF_SETTINGS_FILES,
    PRETTIER_JSON_FILES,
    EDITORCONFIG_SECTION,
    EDITORCONFIG_COMMENT,
} from '#cli/config/commands/init.ts';

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
    const prettier = (options?.overrides ?? []).map((entry) =>
        stripUndefined({
            paths: (Array.isArray(entry.files) ? entry.files : [entry.files]).map((glob) =>
                glob.includes('/') ? glob : `**/${glob}`,
            ),
            indent_width: entry.options.tabWidth,
            print_width: entry.options.printWidth,
            quotes: convertQuotes(entry.options.singleQuote),
        }),
    );
    // Python files get their own quotes when Ruff reads quotes that differ from the rest.
    const python = scope.hasPython ? (readPythonQuotes(scope.root) ?? DEFAULT_QUOTES.ruff) : undefined;
    const pythonOverride =
        python === undefined || python === (scope.quotes ?? DEFAULT_QUOTES.ruff)
            ? []
            : [{ paths: [...PYTHON_FILES], quotes: python }];
    return [...prettier, ...pythonOverride].filter((entry) => Object.keys(entry).length > 1);
}

// Resolve tab indentation and numeric widths from the selected EditorConfig fields.
function parseEditorWidths(fields: Record<string, string>): PrettierOptions {
    const width = fields['indent_size'] === 'tab' ? fields['tab_width'] : fields['indent_size'];
    const tabWidth = width === undefined || !DIGITS_ONLY.test(width) ? undefined : Number(width);
    const lineWidth = fields['max_line_length'];
    const printWidth = lineWidth === undefined || !DIGITS_ONLY.test(lineWidth) ? undefined : Number(lineWidth);
    return stripUndefined({ tabWidth, printWidth });
}

/**
 * Read the project-wide EditorConfig options and the sections that override them, without running project code.
 *
 * @param folder the project folder.
 * @returns the formatting options, or null when the project has no EditorConfig.
 */
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

/**
 * Read JSON Prettier settings or EditorConfig sections, and run no authored code.
 *
 * @param file the path of the project package.json.
 * @param dependencies what the project package.json declares.
 * @param prettierFiles the Prettier settings that init found.
 * @returns the formatting options and overrides, or null when neither formatter has settings.
 */
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
        .find((entry): entry is { path: string; text: string } => entry.text !== undefined);
    const usesPrettier =
        prettierFile !== undefined || packageOptions !== undefined || dependencies['prettier'] !== undefined;
    if (usesPrettier) {
        let options: unknown = isRecord(packageOptions) ? packageOptions : {};
        if (prettierFile !== undefined && (PRETTIER_JSON_FILES as readonly string[]).includes(prettierFile.path))
            options = parseJsonFile(posix.join(root, prettierFile.path), prettierFile.text);
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
    const selected = selectForScope(buildDraftSelection(draft), scope, configurations);
    const format = selected.find((entry) => entry.name === FORMAT_CONFIGURATION);
    if (format === undefined) return {};
    const options = readFormatOptions(
        posix.join(repository.root, scope, PACKAGE_JSON),
        Object.fromEntries(
            repository.dependencyFiles
                .filter((entry) => findScope(entry.path, draft.scopes).path === scope)
                .flatMap((entry) => Object.entries(entry.dependencies)),
        ),
        getTool([format], 'prettier').replace as string[],
    );
    const quotes = convertQuotes(options?.singleQuote);
    const hasPython = repository.files.some(
        (file) => file.path.endsWith(PYTHON_EXTENSION) && findScope(file.path, draft.scopes).path === scope,
    );
    const overrides = buildFormatOverrides(options, { root: posix.join(repository.root, scope), quotes, hasPython });
    if (options === null) return overrides.length === 0 ? {} : { format: { override: overrides } };
    const fields = stripUndefined({
        indent_width: options.tabWidth,
        print_width: options.printWidth,
        quotes,
        override: overrides.length === 0 ? undefined : overrides,
    });
    return { format: { ...fields } };
}

/**
 * Read the formatting options for each scope that init sets up.
 *
 * @param draft the configurations.
 * @param repository the root and the tracked files.
 * @param configurations every configuration.
 * @returns the formatting tables.
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
