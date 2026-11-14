import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isTable } from '#cli/system/tables.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { muteOutput } from '#cli/system/terminal.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { joinScopeSelector } from '#cli/settings/values/paths.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { joinScope, listOwnFiles } from '#cli/repository/scopes.ts';
import { prettierSettingsSchema } from '#cli/schemas/generation.ts';
import { FORMAT_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { tryParseFile, parseFileFields } from '#cli/parsers/validation.ts';
import type { TomlTable, ScopeConfigurations } from '#cli/types/settings.ts';
import { readEditorconfig } from '#cli/generation/setup/format/editorconfig.ts';
import { buildFormatterOverrides } from '#cli/generation/setup/format/overrides.ts';
import type { Repository, ScopeFolder, TrackedFile } from '#cli/types/repository.ts';

import type {
    FormatSearch,
    PrettierStyle,
    SettingsDraft,
    PrettierOptions,
    PrettierScripts,
} from '#cli/types/generation.ts';
import {
    PROSE_TAGS,
    EDITORCONFIG_FILE,
    PRETTIER_DEFAULTS,
    PRETTIER_PACKAGE_KEY,
    PRETTIER_SCRIPT_FILE,
    PRETTIER_SCRIPT_NAME,
    PRETTIER_FILE_FORMATS,
} from '#cli/config/generation/setup.ts';

function convertQuotes({ singleQuote }: Pick<PrettierStyle, 'singleQuote'>): 'single' | 'double' | undefined {
    if (singleQuote === undefined) return undefined;
    return singleQuote ? 'single' : 'double';
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
