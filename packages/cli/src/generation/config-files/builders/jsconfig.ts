import { getValueAt } from '#cli/system/tables.ts';
import { join, dirname, relative } from 'node:path';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import { getTable } from '#cli/settings/scope-settings.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import { JSCONFIG_FILE, TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { convertToGlobs, buildIgnoreSections } from '#cli/generation/config-files/ignore-files.ts';

import {
    JAVASCRIPT_IMPORTS,
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXTENSIONS,
    SOURCE_SELECTION_FIELDS,
    JAVASCRIPT_IGNORED_GLOBS,
    JAVASCRIPT_BUNDLED_IMPORTS,
} from '#cli/config/generation/config-files/builders/jsconfig.ts';

// An exclude here replaces the inherited one and the compiler defaults, so it repeats the entries of your own tsconfig.
// TypeScript takes the exclude of the nearest file in the extends chain, relative to that file.
function buildExtendedExclude(
    planned: PlannedConfigFile,
    paths: { prefix: string; owner: string; ignoredGlobs: string[] },
    authored: TypeScriptConfiguration,
): string[] {
    const { root, reads } = planned.session;
    const generatedFolder = join(root, dirname(planned.targetPath));
    const chain = [paths.owner, ...authored.extendedConfigurationFiles];
    const declaring = chain
        .map((file) => ({
            file,
            exclude: getValueAt(file === paths.owner ? authored.raw : readTsconfig(root, file, reads)?.raw, [
                'exclude',
            ]),
        }))
        .find(({ exclude }) => Array.isArray(exclude));
    const inherited = Array.isArray(declaring?.exclude)
        ? declaring.exclude.map((entry) =>
              convertToPosixPath(relative(generatedFolder, join(dirname(declaring.file), String(entry)))),
          )
        : [];
    return [...paths.ignoredGlobs.map((path) => `${paths.prefix}${path}`), ...inherited];
}

// Only tracked declaration files: a gitignored one, such as a dev server's route types, differs per machine.
function listTrackedDeclarationFiles(planned: PlannedConfigFile, authored: TypeScriptConfiguration): string[] {
    const { root } = planned.session;
    const tracked = new Set(planned.session.repository.files.map((file) => file.path));
    return authored.fileNames
        .filter(
            (path) =>
                DECLARATION_EXTENSIONS.includes(extractExtension(path)) &&
                tracked.has(convertToPosixPath(relative(root, path))),
        )
        .map((path) => convertToPosixPath(relative(join(root, dirname(planned.targetPath)), path)));
}

/**
 * Build jsconfig.json: the JavaScript type-checking project and its scoped source selectors.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the JavaScript type-checking project and its scoped source selectors.
 */
export function buildJsconfigFile(planned: PlannedConfigFile): string {
    const { root, reads } = planned.session;
    const { targetPath: target } = planned;
    const { files } = planned.session.repository;
    const scope = planned.scope.folder.path;
    const scopes = planned.session.scopes.map((entry) => entry.folder);
    const importStyle = getTable(planned.scope.settings, 'tools.eslint').import_extension;
    const ignoredGlobs = convertToGlobs(
        buildIgnoreSections(planned.session).filter((section) => planned.level !== 'all' || section.key !== 'build'),
    );
    const jsconfigOwner = readTsconfig(root, join(root, scope, JSCONFIG_FILE), reads);
    const owner = jsconfigOwner === undefined ? TSCONFIG_FILE : JSCONFIG_FILE;
    const authored = jsconfigOwner ?? readTsconfig(root, join(root, scope, owner), reads);
    const prefix = convertToPosixPath(relative(dirname(target), scope)) + '/';
    const compilerOptions: Record<string, unknown> = { ...JAVASCRIPT_OPTIONS, jsx: JAVASCRIPT_IMPORTS.jsx };
    const jsconfig: Record<string, unknown> = { compilerOptions };
    const extensionless = files.some(
        (file) =>
            importStyle === 'extensionless' &&
            file.kind === 'source' &&
            file.tags.includes('javascript') &&
            findScopeFolder(file.path, scopes).path === scope,
    );
    const hasSourceSelection = SOURCE_SELECTION_FIELDS.some(
        (field) => getValueAt(jsconfigOwner?.raw, [field]) !== undefined,
    );
    if (!hasSourceSelection)
        jsconfig['include'] = JAVASCRIPT_EXTENSIONS.map((extension) => `${prefix}**/*.${extension}`);
    if (authored === undefined) {
        Object.assign(compilerOptions, JAVASCRIPT_IMPORTS, extensionless ? JAVASCRIPT_BUNDLED_IMPORTS : {});
        jsconfig['exclude'] = [...new Set([...ignoredGlobs, ...JAVASCRIPT_IGNORED_GLOBS])].map(
            (path) => `${prefix}${path}`,
        );
        return JSON.stringify(jsconfig, null, JSON_INDENT);
    }
    jsconfig['extends'] = `${prefix}${owner}`;
    if (authored.options.jsx !== undefined) delete compilerOptions['jsx'];
    jsconfig['exclude'] = buildExtendedExclude(
        planned,
        {
            prefix,
            owner: join(root, scope, owner),
            ignoredGlobs: [...new Set([...ignoredGlobs, ...JAVASCRIPT_IGNORED_GLOBS])],
        },
        authored,
    );
    if (jsconfigOwner === undefined) jsconfig['files'] = listTrackedDeclarationFiles(planned, authored);
    return JSON.stringify(jsconfig, null, JSON_INDENT);
}
