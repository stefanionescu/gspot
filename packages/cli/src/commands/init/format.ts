import { z } from 'zod';
import { posix } from 'node:path';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { selectForScope } from '#cli/repository/coverage.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { DEFAULT_QUOTES } from '#cli/config/generation/formatting.ts';
import { buildDraftSelection } from '#cli/commands/init/settings-text.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import type { SettingsDraft, InitFormatOptions } from '#cli/types/commands/init.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';

import {
    PYTHON_FILES,
    PYTHON_EXTENSION,
    EDITORCONFIG_FILE,
    PRETTIER_DEFAULTS,
    RUFF_SETTINGS_FILES,
    EDITORCONFIG_NUMBER,
    PRETTIER_JSON_FILES,
    EDITORCONFIG_SECTION,
    EDITORCONFIG_COMMENT,
} from '#cli/config/commands/init.ts';

// Read only the formatting options that gspot settings use.
const fileFormatSchema = z.object({
    tabWidth: z.number().optional(),
    printWidth: z.number().optional(),
    singleQuote: z.boolean().optional(),
} satisfies SchemaShape<Omit<InitFormatOptions, 'overrides'>>);

const formatOptionsSchema = fileFormatSchema.extend({
    overrides: z
        .array(
            z.object({
                files: z.union([z.string(), z.array(z.string())]),
                options: fileFormatSchema,
            } satisfies SchemaShape<NonNullable<InitFormatOptions['overrides']>[number]>),
        )
        .optional(),
} satisfies SchemaShape<Pick<InitFormatOptions, 'overrides'>>) satisfies z.ZodType<InitFormatOptions>;

const ruffFormatSchema = z.looseObject({
    format: z.looseObject({ 'quote-style': z.string().optional() }).optional(),
    tool: z
        .looseObject({
            ruff: z
                .looseObject({ format: z.looseObject({ 'quote-style': z.string().optional() }).optional() })
                .optional(),
        })
        .optional(),
});

// Prettier matches a glob without a slash against the file name, in any folder.
function convertPrettierFiles(files: string | string[]): string[] {
    return (Array.isArray(files) ? files : [files]).map((glob) => (glob.includes('/') ? glob : `**/${glob}`));
}

function convertQuotes(singleQuote: boolean | undefined): 'single' | 'double' | undefined {
    if (singleQuote === undefined) return undefined;
    return singleQuote ? 'single' : 'double';
}

function readQuoteStyle(file: string, text: string): string | undefined {
    const parsed = ruffFormatSchema.parse(parseToml(text));
    const format = file === PYPROJECT_TOML ? parsed.tool?.ruff?.format : parsed.format;
    return format?.['quote-style'];
}

function readPythonQuotes(root: string): string | undefined {
    for (const file of RUFF_SETTINGS_FILES) {
        const text = readText(root, file);
        const quotes = text === undefined ? undefined : readQuoteStyle(file, text);
        if (quotes !== undefined) return quotes;
    }
    return undefined;
}

function buildPythonOverride(root: string, quotes: string | undefined, hasPython: boolean): TomlTable[] {
    if (!hasPython) return [];
    const python = readPythonQuotes(root) ?? DEFAULT_QUOTES.ruff;
    return python === (quotes ?? DEFAULT_QUOTES.ruff) ? [] : [{ paths: [...PYTHON_FILES], quotes: python }];
}

function buildFormatOverrides(
    options: InitFormatOptions | null,
    scope: { root: string; quotes: string | undefined; hasPython: boolean },
): TomlTable[] {
    const prettier = (options?.overrides ?? []).map((entry) =>
        stripUndefined({
            paths: convertPrettierFiles(entry.files),
            indent_width: entry.options.tabWidth,
            print_width: entry.options.printWidth,
            quotes: convertQuotes(entry.options.singleQuote),
        }),
    );
    return [...prettier, ...buildPythonOverride(scope.root, scope.quotes, scope.hasPython)].filter(
        (entry) => Object.keys(entry).length > 1,
    );
}

// Resolve tab indentation and numeric widths from the selected EditorConfig fields.
function parseEditorWidths(fields: Record<string, string>): InitFormatOptions {
    const width = fields['indent_size'] === 'tab' ? fields['tab_width'] : fields['indent_size'];
    const tabWidth = width === undefined || !EDITORCONFIG_NUMBER.test(width) ? undefined : Number(width);
    const lineWidth = fields['max_line_length'];
    const printWidth = lineWidth === undefined || !EDITORCONFIG_NUMBER.test(lineWidth) ? undefined : Number(lineWidth);
    return stripUndefined({ tabWidth, printWidth, singleQuote: undefined });
}

/**
 * Read the project-wide EditorConfig options and the sections that override them, without running project code.
 *
 * @param folder the project folder.
 * @returns the formatting options, or null when the project has no EditorConfig.
 */
function readFormattingFields(folder: string): InitFormatOptions | null {
    const text = readText(folder, EDITORCONFIG_FILE);
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
): InitFormatOptions | null {
    const root = posix.dirname(file);
    const packageJson = readText(root, PACKAGE_JSON);
    const packageOptions = packageJson === undefined ? undefined : parseJsonFile(file, packageJson)['prettier'];
    const prettierFile = prettierFiles
        .map((path) => ({ path, text: readText(root, path) }))
        .find((entry): entry is { path: string; text: string } => entry.text !== undefined);
    const usesPrettier =
        prettierFile !== undefined || packageOptions !== undefined || dependencies['prettier'] !== undefined;
    if (usesPrettier) {
        let options: unknown = isRecord(packageOptions) ? packageOptions : {};
        if (prettierFile !== undefined && (PRETTIER_JSON_FILES as readonly string[]).includes(prettierFile.path))
            options = parseJsonFile(posix.join(root, prettierFile.path), prettierFile.text);
        return { ...PRETTIER_DEFAULTS, ...stripUndefined(formatOptionsSchema.parse(options)) };
    }
    return readFormattingFields(root);
}

function readScopeFormat(
    scope: string,
    context: {
        draft: SettingsDraft;
        repository: Repository;
        manifests: Map<string, Manifest>;
        dependencyFiles: DependencyFile[];
    },
): TomlTable {
    const { draft, repository, manifests, dependencyFiles } = context;
    const configurations = selectForScope(buildDraftSelection(draft), scope, manifests);
    const format = configurations.find((entry) => entry.configuration.name === 'format');
    if (format === undefined) return {};
    const options = readFormatOptions(
        posix.join(repository.root, scope, PACKAGE_JSON),
        Object.fromEntries(
            dependencyFiles
                .filter((entry) => findScope(entry.path, draft.scopes).path === scope)
                .flatMap((entry) => Object.entries(entry.dependencies)),
        ),
        getToolDeclaration([format], 'prettier').replace as string[],
    );
    const quotes = convertQuotes(options?.singleQuote);
    const hasPython = repository.files.some(
        (file) => file.path.endsWith(PYTHON_EXTENSION) && findScope(file.path, draft.scopes).path === scope,
    );
    const overrides = buildFormatOverrides(options, { root: posix.join(repository.root, scope), quotes, hasPython });
    if (options === null)
        return overrides.length === 0 ? {} : { format: { override: overrides, ...draft.template?.tables.format } };
    const fields = stripUndefined({
        indent_width: options.tabWidth,
        print_width: options.printWidth,
        quotes,
        override: overrides.length === 0 ? undefined : overrides,
    });
    return { format: { ...fields, ...draft.template?.tables.format } };
}

/**
 * Read the formatting options for each scope that init sets up.
 *
 * @param draft the configurations and the template.
 * @param repository the root and the tracked files.
 * @param manifests every configuration.
 * @param dependencyFiles the parsed package declarations.
 * @returns the formatting tables, with the template values kept.
 */
export function readFormatTables(
    draft: SettingsDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    dependencyFiles: DependencyFile[],
): Map<string, TomlTable> {
    const context = { draft, repository, manifests, dependencyFiles };
    return new Map(
        ['', ...draft.scopes.map((scope) => scope.path)].map((scope): [string, TomlTable] => [
            scope,
            readScopeFormat(scope, context),
        ]),
    );
}
