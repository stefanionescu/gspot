import { z } from 'zod';
import { posix } from 'node:path';
import picomatch from 'picomatch';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { buildDraftSelection } from '#cli/commands/init/settings-text.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import type { SettingsDraft, InitFormatOptions } from '#cli/types/commands/init.ts';

import {
    EDITORCONFIG_FILE,
    PRETTIER_DEFAULTS,
    EDITORCONFIG_NUMBER,
    PRETTIER_JSON_FILES,
    EDITORCONFIG_SECTION,
    EDITORCONFIG_COMMENT,
} from '#cli/config/commands/init.ts';

// Read only the formatting options that gspot settings use.
const formatOptionsSchema = z.object({
    tabWidth: z.number().optional(),
    printWidth: z.number().optional(),
    singleQuote: z.boolean().optional(),
} satisfies SchemaShape<InitFormatOptions, InitFormatOptions>);

function parseFormattingWidth(value: string | undefined): number | undefined {
    return value === undefined || !EDITORCONFIG_NUMBER.test(value) ? undefined : Number(value);
}

/**
 * Read the matching EditorConfig options, and run no project code.
 * @param file the path of the project package.json.
 * @returns the formatting options, or null when the project has no EditorConfig.
 */
function readFormattingFields(file: string): InitFormatOptions | null {
    const root = posix.dirname(file);
    const text = readText(root, EDITORCONFIG_FILE);
    if (text === undefined) return null;
    let applies = false;
    const matching: string[] = [];
    for (const line of text.split(/\r?\n/u).filter((line) => !EDITORCONFIG_COMMENT.test(line))) {
        const section = EDITORCONFIG_SECTION.exec(line);
        if (section !== null) {
            applies = picomatch(section[1] as string, { dot: true, matchBase: true })(posix.basename(file));
            continue;
        }
        if (applies) matching.push(line);
    }
    const fields = Object.fromEntries(
        matching.flatMap((line) => {
            const equal = line.indexOf('=');
            return equal === -1 ? [] : [[line.slice(0, equal).trim(), line.slice(equal + 1).trim()]];
        }),
    );
    const width = fields['indent_size'] === 'tab' ? fields['tab_width'] : fields['indent_size'];
    const tabWidth = parseFormattingWidth(width);
    const lineWidth = fields['max_line_length'];
    const printWidth = parseFormattingWidth(lineWidth);
    return stripUndefined({ tabWidth, printWidth, singleQuote: undefined });
}

/**
 * Read JSON Prettier settings or the matching EditorConfig section, and run no authored code.
 * @param file the path of the project package.json.
 * @param dependencies what the project package.json declares.
 * @param prettierFiles the Prettier settings that init found.
 * @returns the three formatting options, or null when neither formatter has settings.
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
    return readFormattingFields(file);
}

/**
 * Read the formatting options for each scope that init sets up.
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
    const selection = buildDraftSelection(draft);
    return new Map(
        ['', ...draft.scopes.map((scope) => scope.path)].map((scope) => {
            const configurations = selectForScope(selection, scope, manifests);
            const format = configurations.find((entry) => entry.configuration.name === 'format');
            if (format === undefined) return [scope, {}] as const;
            const options = readFormatOptions(
                posix.join(repository.root, scope, PACKAGE_JSON),
                Object.fromEntries(
                    dependencyFiles
                        .filter((entry) => findScope(entry.path, draft.scopes).path === scope)
                        .flatMap((entry) => Object.entries(entry.dependencies)),
                ),
                getToolDeclaration([format], 'prettier').replace as string[],
            );
            if (options === null) return [scope, {}] as const;
            let quotes;
            if (options.singleQuote !== undefined) quotes = options.singleQuote ? 'single' : 'double';
            const fields = stripUndefined({
                indent_width: options.tabWidth,
                print_width: options.printWidth,
                quotes,
            });
            return [scope, { format: { ...fields, ...draft.template?.tables.format } }] as const;
        }),
    );
}
