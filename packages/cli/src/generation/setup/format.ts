import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

import { EDITORCONFIG_FIXED_SECTIONS } from '#cli/config/configurations/general.ts';
import { DIGITS_ONLY } from '#cli/config/configurations/naming.ts';
import {
    EDITORCONFIG_COMMENT,
    EDITORCONFIG_FILE,
    EDITORCONFIG_SECTION,
    FORMATTER_DEFAULTS,
    PRETTIER_DEFAULTS,
    PRETTIER_FILE_FORMATS,
    PRETTIER_PACKAGE_KEY,
    PRETTIER_SCRIPT_FILE,
    PRETTIER_SCRIPT_NAME,
    PROSE_TAGS,
    PYTHON_TAG,
    RUFF_SETTINGS_FILES,
    UNREADABLE_CONFIG_MESSAGE,
} from '#cli/config/generation/setup.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { FORMAT_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { LINE_BREAK } from '#cli/config/system.ts';
import { detectScriptIndent, SCRIPT_FILES } from '#cli/generation/setup/script-indent.ts';
import { getTool } from '#cli/manifests/read.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { joinScope, listOwnFiles } from '#cli/repository/scopes.ts';
import {
    prettierOptionsSchema,
    prettierSettingsSchema,
    ruffOptionsSchema,
    ruffProjectSchema,
} from '#cli/schemas/generation.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { parseFileFields, tryParseFile } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { isTable } from '#cli/system/tables.ts';
import { muteOutput } from '#cli/system/terminal.ts';
import type {
    EditorconfigSection,
    FormatSearch,
    PrettierOptions,
    PrettierScripts,
    PrettierStyle,
    RuffOptions,
    SettingsDraft,
} from '#cli/types/generation.ts';
import type { Repository, ScopeFolder, TrackedFile } from '#cli/types/repository.ts';
import type { ScopeConfigurations, TomlTable } from '#cli/types/settings.ts';

function convertQuotes({ singleQuote }: Pick<PrettierStyle, 'singleQuote'>): 'single' | 'double' | undefined {
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

function convertPrettierFormat(options: PrettierStyle): TomlTable {
    const indent = options.useTabs === true ? 'tab' : 'space';
    const indentStyle = options.useTabs === undefined ? undefined : indent;
    return {
        indent_style: indentStyle,
        indent_width: options.tabWidth,
        print_width: options.printWidth,
        quotes: convertQuotes(options),
        semicolons: options.semi,
        trailing_commas: options.trailingComma,
        bracket_spacing: options.bracketSpacing,
        arrow_parens: options.arrowParens,
        prose_wrap: options.proseWrap,
    };
}

function keepDiffering(
    paths: readonly string[],
    format: TomlTable,
    { fields, trackedPaths }: { fields: TomlTable; trackedPaths: readonly string[] },
): TomlTable[] {
    const differing = Object.entries(format).filter(([key, value]) => fields[key] !== value);
    const tracked = paths.filter((glob) => trackedPaths.some(buildPathMatcher([glob])));
    return differing.length === 0 || tracked.length === 0 ? [] : [{ paths: tracked, ...Object.fromEntries(differing) }];
}

function buildFormatterOverrides(
    fields: TomlTable,
    repository: Repository,
    trackedPaths: readonly string[],
): TomlTable[] {
    const tags = new Set(repository.files.filter((file) => file.kind === 'source').flatMap((file) => file.tags));
    const ruff = readRuffOptions(repository.root)?.options;
    const printWidth = readEditorconfig(repository.root)?.printWidth;
    const written = printWidth === undefined ? {} : { print_width: printWidth };
    return [
        ...FORMATTER_DEFAULTS.filter(({ tag }) => tags.has(tag)).flatMap(({ tag, paths, format }) => {
            const carried = tag === PYTHON_TAG && ruff !== undefined ? convertRuffFormat(ruff) : {};
            return keepDiffering(paths, { ...format, ...written, ...carried }, { fields, trackedPaths });
        }),
        ...keepDiffering(SCRIPT_FILES, detectScriptIndent(repository), { fields, trackedPaths }),
    ];
}

function listLineSettings(files: string, fields: Record<string, string>): string[] {
    const sections: Readonly<Record<string, object>> = EDITORCONFIG_FIXED_SECTIONS;
    return Object.entries({ ...sections['*'], ...sections[files] })
        .filter(([key, value]) => fields[key] !== undefined && fields[key] !== String(value))
        .map(([key]) => key);
}

function parseEditorWidths(fields: Record<string, string>): Record<string, unknown> {
    const { max_line_length: lineWidth } = fields;
    const width = fields['indent_size'] === 'tab' ? fields['tab_width'] : fields['indent_size'];
    const widths: Record<string, unknown> = {};
    if (width !== undefined && DIGITS_ONLY.test(width)) widths['tabWidth'] = Number(width);
    if (lineWidth === 'off') widths['printWidth'] = lineWidth;
    if (lineWidth !== undefined && DIGITS_ONLY.test(lineWidth)) widths['printWidth'] = Number(lineWidth);
    return widths;
}

function parseEditorSection(files: string, fields: Record<string, string>): PrettierOptions {
    const { indent_style: style, quote_type: quotes } = fields;
    const options = parseEditorWidths(fields);
    if (style === 'tab' || style === 'space') options['useTabs'] = style === 'tab';
    if (quotes === 'single' || quotes === 'double') options['singleQuote'] = quotes === 'single';
    const parsed = prettierOptionsSchema.parse(options);
    return { ...parsed, dropped: [...parsed.dropped, ...listLineSettings(files, fields)] };
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
        ...parseEditorSection('*', project),
        overrides: sections
            .filter(({ files }) => files !== '*')
            .map(({ files, fields }) => ({ files, options: parseEditorSection(files, fields) })),
    };
}

function readPackagePrettier(root: string, path: string): unknown {
    const text = findText(root, path);
    return text === undefined ? undefined : tryParseFile(() => parseJsonFile(path, text)['prettier']);
}

function hasCode(repository: Repository): boolean {
    return repository.files.some((file) => file.kind === 'source' && file.tags.some((tag) => !PROSE_TAGS.has(tag)));
}

function listParsedPrettierFiles({ root, scopePath, scripts }: FormatSearch, prettierFiles: readonly string[]) {
    return prettierFiles
        .filter((name) => name !== '.prettierignore')
        .flatMap((name) => {
            const path = joinScope(scopePath, name);
            const text = findText(root, path);
            const options = text === undefined ? undefined : parsePrettierFile(path, text, scripts);
            return options === undefined ? [] : [{ path, options }];
        });
}

function readFormatOptions(
    search: FormatSearch,
    dependencies: Record<string, string>,
    prettierFiles: readonly string[],
): PrettierStyle | null {
    const { root, scopePath } = search;
    const editorconfig = readEditorconfig(posix.join(root, scopePath));
    const packagePath = posix.join(scopePath, PACKAGE_JSON);
    const packageOptions = readPackagePrettier(root, packagePath);
    const prettierFile = listParsedPrettierFiles(search, prettierFiles)[0];
    const hasPrettier =
        prettierFile !== undefined || packageOptions !== undefined || dependencies['prettier'] !== undefined;
    if (!hasPrettier) return editorconfig;
    const packageFields = isTable(packageOptions) ? packageOptions : {};
    const options = prettierFile?.options ?? parseFileFields(packagePath, packageFields, prettierSettingsSchema);
    const overrides = [editorconfig, options].flatMap((source) => source?.overrides ?? []);
    return { ...PRETTIER_DEFAULTS, ...editorconfig, ...options, overrides };
}

/**
Build the format overrides of a Prettier config. A glob that matches no tracked file stays out, because
`gspot/unmatched-paths` reports such a glob.
*/
export function buildPrettierOverrides(
    options: PrettierStyle | null,
    scopePath: string,
    trackedPaths: readonly string[],
): TomlTable[] {
    return (options?.overrides ?? [])
        .map((override) => ({
            paths: [override.files]
                .flat()
                .map((glob) => (glob.includes('/') ? glob : `**/${glob}`))
                .filter((glob) => trackedPaths.some(buildPathMatcher([joinScopeSelector(glob, scopePath)]))),
            ...convertPrettierFormat(override.options),
        }))
        .filter(
            (override: TomlTable & { paths: string[] }) =>
                override.paths.length > 0 && Object.values(override).filter((value) => value !== undefined).length > 1,
        );
}

export function readRuffOptions(root: string): { path: string; options: RuffOptions } | undefined {
    for (const path of RUFF_SETTINGS_FILES) {
        const text = findText(root, path);
        if (text === undefined) continue;
        const read = tryParseFile(() =>
            path === PYPROJECT_TOML
                ? parseTomlFile(path, text, ruffProjectSchema)
                : { tool: { ruff: parseTomlFile(path, text, ruffOptionsSchema) } },
        );
        if (read === undefined) return { path, options: { dropped: [UNREADABLE_CONFIG_MESSAGE] } };
        if (read.tool?.ruff !== undefined) return { path, options: read.tool.ruff };
    }
    return undefined;
}

/**
Read every Prettier source of a scope. The first entry is the one whose settings init carries over.

@param prettierFiles the files that the Prettier tool of the format manifest replaces.
*/
export function readPrettierOptions(
    root: string,
    scopePath: string,
    scripts: PrettierScripts,
    prettierFiles: readonly string[],
): Array<{ path: string; options: PrettierOptions }> {
    const files = listParsedPrettierFiles({ root, scopePath, scripts }, prettierFiles);
    const packagePath = joinScope(scopePath, PACKAGE_JSON);
    const key = readPackagePrettier(root, packagePath);
    const parsed = prettierSettingsSchema.safeParse(key).data ?? { dropped: [PRETTIER_PACKAGE_KEY] };
    const editorconfig = readEditorconfig(posix.join(root, scopePath));
    return [
        ...files,
        ...(key === undefined ? [] : [{ path: packagePath, options: parsed }]),
        ...(editorconfig === null ? [] : [{ path: joinScope(scopePath, EDITORCONFIG_FILE), options: editorconfig }]),
    ];
}

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
        scripts.map(async (path): Promise<Array<[string, PrettierOptions]>> => {
            let options: PrettierOptions | undefined;
            try {
                const module = (await import(pathToFileURL(join(root, path)).href)) as { default?: unknown };
                options = parseFileFields(path, module.default ?? module, prettierSettingsSchema);
            } catch {
                // A script that does not load or holds other fields stays out, and the carryover table names it.
            }
            return options === undefined ? [] : [[path, options]];
        }),
    );
    return new Map(results.flat());
}

export function parsePrettierFile(path: string, text: string, scripts: PrettierScripts): PrettierOptions | undefined {
    if (PRETTIER_SCRIPT_FILE.test(path)) return scripts.get(path);
    const format = PRETTIER_FILE_FORMATS[posix.basename(path)];
    const parsers = { yaml: parseYamlFile, json: parseJsonFile, toml: parseTomlFile };
    return tryParseFile(() =>
        parseFileFields(path, format === undefined ? {} : parsers[format](path, text), prettierSettingsSchema),
    );
}

export function readScopeFormat(
    { scopePath, selected }: ScopeConfigurations,
    draft: SettingsDraft,
    repository: Repository,
): TomlTable {
    const format = selected.find((configuration) => configuration.name === FORMAT_CONFIGURATION);
    if (format === undefined) return {};
    const read = readFormatOptions(
        { root: repository.root, scopePath, scripts: draft.prettierScripts },
        Object.fromEntries(
            listOwnFiles(repository.dependencyFiles, draft.scopes, scopePath).flatMap((dependencyFile) =>
                Object.entries(dependencyFile.dependencies),
            ),
        ),
        getTool([format], 'prettier').replace as string[],
    );
    const options = scopePath === '' && hasCode(repository) ? { ...PRETTIER_DEFAULTS, ...read } : read;
    const fields = options === null ? {} : convertPrettierFormat(options);
    const overrides = [
        ...buildPrettierOverrides(options, scopePath, draft.trackedPaths),
        ...(scopePath === '' ? buildFormatterOverrides(fields, repository, draft.trackedPaths) : []),
    ];
    const table: TomlTable = { ...fields, ...(overrides.length > 0 && { override: overrides }) };
    return Object.values(table).every((value) => value === undefined) ? {} : { format: table };
}
