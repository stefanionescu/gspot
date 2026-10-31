import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { join, dirname, relative } from 'node:path';
import { JSCONFIG_FILE } from '#cli/config/files/names.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import type { ParsedTsconfig } from '#cli/types/parsers/projects.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/system.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { convertToGlobs, buildIgnoreSections } from '#cli/generation/config-files/ignore-sections.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/configurations/language/javascript/eslint/eslint.ts';

import {
    STANDALONE_OPTIONS,
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXTENSIONS,
    SOURCE_SELECTION_FIELDS,
    JAVASCRIPT_IGNORED_GLOBS,
    JAVASCRIPT_BUNDLED_IMPORTS,
} from '#cli/config/generation/configurations/language/javascript/javascript.ts';

function buildExtendedExclude(
    planned: PlannedConfigFile,
    paths: { prefix: string; owner: string; ignoredGlobs: string[] },
    authored: ParsedTsconfig,
): string[] {
    const { root, cache } = planned.session;
    const generatedFolder = join(root, dirname(planned.targetPath));
    const chain = [paths.owner, ...authored.extendedTsconfigFiles];
    const declaring = chain
        .map((file) => ({
            file,
            exclude: findValueAt(file === paths.owner ? authored.raw : readTsconfig(root, file, cache)?.raw, [
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
    return [...paths.ignoredGlobs, ...inherited];
}

function listTrackedDeclarationFiles(planned: PlannedConfigFile, authored: ParsedTsconfig): string[] {
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
    const scope = planned.scope.path;
    return (
        importStyle === 'extensionless' &&
        files.some(
            (file) =>
                file.kind === 'source' &&
                file.tags.includes('javascript') &&
                selectScopePath(file.path, planned.session.scopes) === scope,
        )
    );
}

/**
Build jsconfig.json: the JavaScript type-checking project and its scoped source selectors.

@param planned the config file to build.
*/
export function buildJsconfigFile(planned: PlannedConfigFile): string {
    const { root, cache } = planned.session;
    const { targetPath: target } = planned;
    const scope = planned.scope.path;
    const importStyle = getTable(planned.scope.settings, ESLINT_SETTINGS_TABLE).import_extension;
    const ignoredGlobs = convertToGlobs(
        buildIgnoreSections(planned.session).filter((section) => planned.level !== 'all' || section.key !== 'build'),
    );
    const rootPrefix = convertToPosixPath(relative(dirname(target), '.')) + '/';
    const scopePrefix = convertToPosixPath(relative(dirname(target), scope)) + '/';
    const excluded = [...new Set([...ignoredGlobs, ...JAVASCRIPT_IGNORED_GLOBS])]
        .filter((path) => !path.startsWith('!'))
        .flatMap((path) => {
            if (path.startsWith('**/')) return [`${scopePrefix}${path}`];
            return scope === '' || path.startsWith(`${scope}/`) ? [`${rootPrefix}${path}`] : [];
        });
    const jsconfigOwner = readTsconfig(root, join(root, scope, JSCONFIG_FILE), cache);
    const owner = jsconfigOwner === undefined ? TSCONFIG_FILE : JSCONFIG_FILE;
    const authored = jsconfigOwner ?? readTsconfig(root, join(root, scope, owner), cache);
    const prefix = convertToPosixPath(relative(dirname(target), scope)) + '/';
    const compilerOptions: Record<string, unknown> = {
        ...JAVASCRIPT_OPTIONS,
        jsx: STANDALONE_OPTIONS.jsx,
        noImplicitAny: planned.level === 'all',
    };
    const jsconfig: Record<string, unknown> = { compilerOptions };
    const isExtensionless = hasExtensionlessSources(planned, importStyle);
    const hasSourceSelection = SOURCE_SELECTION_FIELDS.some(
        (field) => findValueAt(jsconfigOwner?.raw, [field]) !== undefined,
    );
    if (!hasSourceSelection)
        jsconfig['include'] = JAVASCRIPT_EXTENSIONS.map((extension) => `${prefix}**/*.${extension}`);
    if (authored === undefined) {
        Object.assign(compilerOptions, STANDALONE_OPTIONS, isExtensionless ? JAVASCRIPT_BUNDLED_IMPORTS : {});
        jsconfig['exclude'] = excluded;
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
