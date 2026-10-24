import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { join, dirname, relative } from 'node:path';
import { JSCONFIG_FILE } from '#cli/config/files/names.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/projects/tsconfig.ts';
import { convertToGlobs, buildIgnoreSections } from '#cli/generation/config-files/ignore-files.ts';

import {
    JAVASCRIPT_IMPORTS,
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXTENSIONS,
    SOURCE_SELECTION_FIELDS,
    JAVASCRIPT_IGNORED_GLOBS,
    JAVASCRIPT_BUNDLED_IMPORTS,
} from '#cli/config/generation/configurations/language/javascript/jsconfig.ts';

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
        ? declaring.exclude.map((excluded) => {
              const excludedPath = join(dirname(declaring.file), String(excluded));
              return convertToPosixPath(relative(generatedFolder, excludedPath));
          })
        : [];
    return [...paths.ignoredGlobs.map((path) => `${paths.prefix}${path}`), ...inherited];
}

function listTrackedDeclarationFiles(planned: PlannedConfigFile, authored: TypeScriptConfiguration): string[] {
    const { root } = planned.session;
    const tracked = new Set(planned.session.repository.files.map((file) => file.path));
    const generatedFolder = join(root, dirname(planned.targetPath));
    return authored.fileNames
        .filter(
            (path) =>
                DECLARATION_EXTENSIONS.includes(extractExtension(path)) &&
                tracked.has(convertToPosixPath(relative(root, path))),
        )
        .map((path) => convertToPosixPath(relative(generatedFolder, path)));
}

function hasExtensionlessSources(planned: PlannedConfigFile, importStyle: string): boolean {
    const { files } = planned.session.repository;
    const scope = planned.scope.folder.path;
    const scopes = planned.session.scopes.map((each) => each.folder);
    return (
        importStyle === 'extensionless' &&
        files.some(
            (file) =>
                file.kind === 'source' &&
                file.tags.includes('javascript') &&
                findScopeFolder(file.path, scopes).path === scope,
        )
    );
}

/**
Build jsconfig.json: the JavaScript type-checking project and its scoped source selectors.

@param planned the config file with its scope, level, and target path.
@returns the JavaScript type-checking project and its scoped source selectors.
*/
export function buildJsconfigFile(planned: PlannedConfigFile): string {
    const { root, reads } = planned.session;
    const { targetPath: target } = planned;
    const scope = planned.scope.folder.path;
    const importStyle = getTable(planned.scope.settings, 'tools.eslint').import_extension;
    const ignoredGlobs = convertToGlobs(
        buildIgnoreSections(planned.session).filter((section) => planned.level !== 'all' || section.key !== 'build'),
    );
    const excluded = [...new Set([...ignoredGlobs, ...JAVASCRIPT_IGNORED_GLOBS])];
    const jsconfigOwner = readTsconfig(root, join(root, scope, JSCONFIG_FILE), reads);
    const owner = jsconfigOwner === undefined ? TSCONFIG_FILE : JSCONFIG_FILE;
    const authored = jsconfigOwner ?? readTsconfig(root, join(root, scope, owner), reads);
    const prefix = convertToPosixPath(relative(dirname(target), scope)) + '/';
    const compilerOptions: Record<string, unknown> = {
        ...JAVASCRIPT_OPTIONS,
        jsx: JAVASCRIPT_IMPORTS.jsx,
        noImplicitAny: planned.level === 'all',
    };
    const jsconfig: Record<string, unknown> = { compilerOptions };
    const isExtensionless = hasExtensionlessSources(planned, importStyle);
    const hasSourceSelection = SOURCE_SELECTION_FIELDS.some(
        (field) => getValueAt(jsconfigOwner?.raw, [field]) !== undefined,
    );
    if (!hasSourceSelection)
        jsconfig['include'] = JAVASCRIPT_EXTENSIONS.map((extension) => `${prefix}**/*.${extension}`);
    if (authored === undefined) {
        Object.assign(compilerOptions, JAVASCRIPT_IMPORTS, isExtensionless ? JAVASCRIPT_BUNDLED_IMPORTS : {});
        jsconfig['exclude'] = excluded.map((path) => `${prefix}${path}`);
        return JSON.stringify(jsconfig, null, JSON_INDENT);
    }
    jsconfig['extends'] = `${prefix}${owner}`;
    if (authored.options.jsx !== undefined) delete compilerOptions['jsx'];
    jsconfig['exclude'] = buildExtendedExclude(
        planned,
        {
            prefix,
            owner: join(root, scope, owner),
            ignoredGlobs: excluded,
        },
        authored,
    );
    if (jsconfigOwner === undefined) jsconfig['files'] = listTrackedDeclarationFiles(planned, authored);
    return JSON.stringify(jsconfig, null, JSON_INDENT);
}
