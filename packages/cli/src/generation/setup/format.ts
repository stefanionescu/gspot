import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getTool } from '#cli/tools/pins.ts';
import { isTable } from '#cli/system/tables.ts';
import { muteOutput } from '#cli/system/terminal.ts';
import { findText } from '#cli/system/files/reads.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { DIGITS_ONLY } from '#cli/config/configurations/naming.ts';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';
import { PRETTIER_ROOT_FILES } from '#cli/config/repository/setup.ts';
import type { TomlTable, ScopeConfigurations } from '#cli/types/settings.ts';
import { LINE_BREAK, PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers.ts';
import type { Repository, ScopeFolder, TrackedFile } from '#cli/types/repository.ts';
import { ruffOptionsSchema, ruffProjectSchema, prettierSettingsSchema } from '#cli/schemas/generation.ts';

import type {
    RuffOptions,
    FormatSearch,
    SettingsDraft,
    PrettierOptions,
    PrettierScripts,
    EditorconfigSection,
} from '#cli/types/generation.ts';
import {
    PROSE_TAGS,
    PYTHON_TAG,
    PRETTIER_DEFAULTS,
    EDITORCONFIG_FILE,
    FORMATTER_DEFAULTS,
    RUFF_SETTINGS_FILES,
    FORMAT_CONFIGURATION,
    PRETTIER_SCRIPT_FILE,
    PRETTIER_SCRIPT_NAME,
    EDITORCONFIG_SECTION,
    EDITORCONFIG_COMMENT,
    PRETTIER_FILE_FORMATS,
} from '#cli/config/generation.ts';

function convertQuotes(singleQuote: boolean | undefined): 'single' | 'double' | undefined {
    if (singleQuote === undefined) return undefined;
    return singleQuote ? 'single' : 'double';
}

function convertRuffFormat(options: RuffOptions): TomlTable {
    const fields = {
        indent_style: options.format?.['indent-style'],
        indent_width: options['indent-width'],
        print_width: options['line-length'],
        quotes: options.format?.['quote-style'],
    };
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
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
        bracket_spacing: options.bracketSpacing,
        arrow_parens: options.arrowParens,
        prose_wrap: options.proseWrap,
    };
}

function buildFormatterOverrides(fields: TomlTable, repository: Repository): TomlTable[] {
    const tags = new Set(repository.files.filter((file) => file.kind === 'source').flatMap((file) => file.tags));
    const ruff = readRuffOptions(repository.root)?.options;
    return FORMATTER_DEFAULTS.filter(({ tag }) => tags.has(tag)).flatMap(({ tag, paths, format }) => {
        const carried = tag === PYTHON_TAG && ruff !== undefined ? convertRuffFormat(ruff) : {};
        const differing = Object.entries({ ...format, ...carried }).filter(([key, value]) => fields[key] !== value);
        return differing.length === 0 ? [] : [{ paths: [...paths], ...Object.fromEntries(differing) }];
    });
}

function buildPrettierOverrides(options: PrettierOptions | null): TomlTable[] {
    return (options?.overrides ?? [])
        .map((override) => ({
            paths: (Array.isArray(override.files) ? override.files : [override.files]).map((glob) =>
                glob.includes('/') ? glob : `**/${glob}`,
            ),
            ...convertPrettierFormat(override.options),
        }))
        .filter((override: TomlTable) => Object.values(override).filter((value) => value !== undefined).length > 1);
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

function hasCode(repository: Repository): boolean {
    return repository.files.some((file) => file.kind === 'source' && file.tags.some((tag) => !PROSE_TAGS.has(tag)));
}

function readFormatOptions(
    { root, scopePath, scripts }: FormatSearch,
    dependencies: Record<string, string>,
    prettierFiles: string[],
): PrettierOptions | null {
    const folder = posix.join(root, scopePath);
    const editorconfig = readEditorconfig(folder);
    const packagePath = posix.join(scopePath, PACKAGE_JSON);
    const packageJson = findText(folder, PACKAGE_JSON);
    const packageOptions = packageJson === undefined ? undefined : parseJsonFile(packagePath, packageJson)['prettier'];
    const prettierFile = prettierFiles
        .filter((path) => path !== '.prettierignore')
        .map((path) => ({ path, text: findText(folder, path) }))
        .find((read): read is { path: string; text: string } => read.text !== undefined);
    const usesPrettier =
        prettierFile !== undefined || packageOptions !== undefined || dependencies['prettier'] !== undefined;
    if (!usesPrettier) return editorconfig;
    const packageFields = isTable(packageOptions) ? packageOptions : {};
    const options =
        prettierFile === undefined
            ? parseFileFields(packagePath, packageFields, prettierSettingsSchema)
            : parsePrettierFile(posix.join(scopePath, prettierFile.path), prettierFile.text, scripts);
    return { ...PRETTIER_DEFAULTS, ...editorconfig, ...options };
}

/**
Read the first Ruff settings of the repository.

@param root the repository root.
@returns the file and its settings, or undefined without Ruff settings.
*/
export function readRuffOptions(root: string): { path: string; options: RuffOptions } | undefined {
    for (const path of RUFF_SETTINGS_FILES) {
        const text = findText(root, path);
        if (text === undefined) continue;
        const options =
            path === PYPROJECT_TOML
                ? parseTomlFile(path, text, ruffProjectSchema).tool?.ruff
                : parseTomlFile(path, text, ruffOptionsSchema);
        if (options !== undefined) return { path, options };
    }
    return undefined;
}

/**
Read the options of each Prettier config at the root.

@param root the repository root.
@param scripts the options of the JavaScript and TypeScript configs that loaded.
@returns the file and its options, for each config that gspot can read.
*/
export function readPrettierOptions(
    root: string,
    scripts: PrettierScripts,
): { path: string; options: PrettierOptions }[] {
    return PRETTIER_ROOT_FILES.flatMap((path) => {
        const text = findText(root, path);
        const options = text === undefined ? undefined : parsePrettierFile(path, text, scripts);
        return options === undefined ? [] : [{ path, options }];
    });
}

/**
Load each JavaScript or TypeScript Prettier config at the root or at a scope, as Prettier does. This runs the code of
the file.

@param root the repository root.
@param files the tracked files.
@param scopes the scopes that init sets up.
@returns the options of each config that loads, by path.
*/
export async function readPrettierScripts(
    root: string,
    files: TrackedFile[],
    scopes: ScopeFolder[],
): Promise<PrettierScripts> {
    const folders = new Set(['.', ...scopes.map(({ path }) => path)]);
    const scripts = files
        .map(({ path }) => path)
        .filter((path) => PRETTIER_SCRIPT_NAME.test(posix.basename(path)) && folders.has(posix.dirname(path)));
    using _output = muteOutput();
    const results = await Promise.all(
        scripts.map(async (path): Promise<[string, PrettierOptions][]> => {
            try {
                const module = (await import(pathToFileURL(join(root, path)).href)) as { default?: unknown };
                return [[path, parseFileFields(path, module.default ?? module, prettierSettingsSchema)]];
            } catch {
                return [];
            }
        }),
    );
    return new Map(results.flat());
}

/**
Read the Prettier options of a config file.

@param path the config file.
@param text its contents.
@param scripts the options of the JavaScript and TypeScript configs that loaded.
@returns the options, or undefined when gspot cannot read the file.
*/
export function parsePrettierFile(path: string, text: string, scripts: PrettierScripts): PrettierOptions | undefined {
    if (PRETTIER_SCRIPT_FILE.test(path)) return scripts.get(path);
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

/**
Read the formatting options of one scope that init sets up.

@param selection the scope and its selected configurations.
@param selection.scope the scope path, empty for the root.
@param selection.selected the configurations selected in the scope.
@param draft the configurations and the template.
@param repository the root and the tracked files.
*/
export function readScopeFormat(
    { scope, selected }: ScopeConfigurations,
    draft: SettingsDraft,
    repository: Repository,
): TomlTable {
    const format = selected.find((configuration) => configuration.name === FORMAT_CONFIGURATION);
    if (format === undefined) return {};
    const read = readFormatOptions(
        { root: repository.root, scopePath: scope, scripts: draft.prettierScripts },
        Object.fromEntries(
            repository.dependencyFiles
                .filter((dependencyFile) => selectScopePath(dependencyFile.path, draft.scopes) === scope)
                .flatMap((dependencyFile) => Object.entries(dependencyFile.dependencies)),
        ),
        getTool([format], 'prettier').replace as string[],
    );
    const options = scope === '' && hasCode(repository) ? { ...PRETTIER_DEFAULTS, ...read } : read;
    const fields = options === null ? {} : convertPrettierFormat(options);
    const overrides = [
        ...buildPrettierOverrides(options),
        ...(scope === '' ? buildFormatterOverrides(fields, repository) : []),
    ];
    const table: TomlTable = { ...fields, ...(overrides.length > 0 && { override: overrides }) };
    return Object.values(table).every((value) => value === undefined) ? {} : { format: table };
}
