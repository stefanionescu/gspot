import { z } from 'zod';
import { posix } from 'node:path';
import picomatch from 'picomatch';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { draftSelection } from '#cli/commands/init/settings-text.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import type { SettingsDraft, InitFormatOptions } from '#cli/types/commands/init.ts';

import {
    PRETTIER_FILES,
    EDITORCONFIG_FILE,
    PRETTIER_DEFAULTS,
    EDITORCONFIG_NUMBER,
    PRETTIER_JSON_FILES,
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
 * Read matching EditorConfig options without executing project code.
 * @param file the project package path
 * @returns the matching formatting options, or null when the project has no EditorConfig
 */
function readFormattingFields(file: string): InitFormatOptions | null {
    const root = posix.dirname(file);
    const text = readText(root, EDITORCONFIG_FILE);
    if (text === undefined) return null;
    let applies = false;
    const matching: string[] = [];
    for (const line of text.split(/\r?\n/u).filter((line) => !EDITORCONFIG_COMMENT.test(line))) {
        const section = /^\s*\[(.+)\]\s*$/u.exec(line);
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
 * Reads JSON Prettier settings or the matching EditorConfig section without executing written code.
 * @param file the project package path
 * @param dependencies the declared project dependencies
 * @returns the three formatting options, or null when the repository configures neither formatter
 */
function readFormatOptions(file: string, dependencies: Record<string, string>): InitFormatOptions | null {
    const root = posix.dirname(file);
    const pkg = readText(root, PACKAGE_JSON);
    const packageOptions = pkg === undefined ? undefined : parseJsonFile(file, pkg)['prettier'];
    const prettierFile = PRETTIER_FILES.map((path) => ({ path, text: readText(root, path) })).find(
        (entry): entry is { path: (typeof PRETTIER_FILES)[number]; text: string } => entry.text !== undefined,
    );
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
 * Reads the formatting fields for the scopes init will configure.
 * @param draft the selected configurations and written template
 * @param repository the source root and tracked files
 * @param manifests the configuration declarations
 * @param packageManifests the already parsed project dependencies
 * @returns inferred formatting tables, with written template values retained
 */
export function readFormatTables(
    draft: SettingsDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    packageManifests: DependencyFile[],
): Map<string, TomlTable> {
    const selection = draftSelection(draft);
    return new Map(
        ['', ...draft.scopes.map((scope) => scope.path)].map((scope) => {
            const configurations = selectForScope(selection, scope, manifests);
            if (!configurations.some((entry) => entry.configuration.name === 'format')) return [scope, {}] as const;
            const options = readFormatOptions(
                posix.join(repository.root, scope, PACKAGE_JSON),
                Object.fromEntries(
                    packageManifests
                        .filter((entry) => findScope(entry.path, draft.scopes).path === scope)
                        .flatMap((entry) => Object.entries(entry.dependencies)),
                ),
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
