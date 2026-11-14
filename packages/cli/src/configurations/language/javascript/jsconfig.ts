import { getTable } from '#cli/settings/tables.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { join, dirname, relative } from 'node:path';
import { listOwnFiles } from '#cli/repository/scopes.ts';
import { JSON_INDENT } from '#cli/config/tools/programs.ts';
import type { ParsedTsconfig } from '#cli/types/parsers.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system.ts';
import { convertToGlobs } from '#cli/configurations/ignores.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { STANDALONE_OPTIONS } from '#cli/config/configurations/shared.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { JSCONFIG_FILE, TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

import {
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXTENSIONS,
    CONFIG_FOLDER_TEMPLATE,
    SOURCE_SELECTION_FIELDS,
    JAVASCRIPT_IGNORED_GLOBS,
    JAVASCRIPT_BUNDLED_IMPORTS,
} from '#cli/config/configurations/javascript/projects.ts';

function buildExtendedExclude(
    planned: PlannedConfig,
    paths: { owner: string; ignoredGlobs: string[] },
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
              // TypeScript reads ${configDir} as the folder of the tsconfig in use, here the one that the jsconfig extends.
              const text = String(excluded);
              const excludedPath = CONFIG_FOLDER_TEMPLATE.test(text)
                  ? join(dirname(paths.owner), text.replace(CONFIG_FOLDER_TEMPLATE, ''))
                  : join(dirname(declaring.file), text);
              return convertToPosixPath(relative(generatedFolder, excludedPath));
          })
        : [];
    return [...paths.ignoredGlobs, ...inherited];
}

function listTrackedDeclarationFiles(planned: PlannedConfig, authored: ParsedTsconfig): string[] {
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

function hasExtensionlessSources(planned: PlannedConfig, importStyle: string): boolean {
    const { repository, scopes } = planned.session;
    return (
        importStyle === 'extensionless' &&
        listOwnFiles(repository.files, scopes, planned.scope.path).some(
            (file) => file.kind === 'source' && file.tags.includes('javascript'),
        )
    );
}

function isAuthoredSelection(authored: ParsedTsconfig | undefined, jsconfig: ParsedTsconfig | undefined): boolean {
    if (authored === undefined) return false;
    const { allowJs, checkJs } = authored.options;
    const isJavascriptProject = jsconfig !== undefined || allowJs === true || checkJs === true;
    return (
        isJavascriptProject && SOURCE_SELECTION_FIELDS.some((field) => findValueAt(authored.raw, [field]) !== undefined)
    );
}

function buildJsconfigFile(planned: PlannedConfig): string {
    const { root, cache } = planned.session;
    const { targetPath: target } = planned;
    const scopePath = planned.scope.path;
    const importStyle = getTable(planned.scope.settings, 'javascript').import_extension;
    const ignoredGlobs = convertToGlobs(
        planned.ignoreSections.filter((section) => planned.level !== 'all' || section.key !== 'build'),
    );
    const rootPrefix = `${convertToPosixPath(relative(dirname(target), '.'))}/`;
    const scopePrefix = `${convertToPosixPath(relative(dirname(target), scopePath))}/`;
    const excluded = [...new Set([...ignoredGlobs, ...JAVASCRIPT_IGNORED_GLOBS])]
        .filter((path) => !path.startsWith('!'))
        .flatMap((path) => {
            if (path.startsWith('**/')) return [`${scopePrefix}${path}`];
            return scopePath === '' || path.startsWith(`${scopePath}/`) ? [`${rootPrefix}${path}`] : [];
        });
    const jsconfigOwner = readTsconfig(root, join(root, scopePath, JSCONFIG_FILE), cache);
    const owner = jsconfigOwner === undefined ? TSCONFIG_FILE : JSCONFIG_FILE;
    const authored = jsconfigOwner ?? readTsconfig(root, join(root, scopePath, owner), cache);
    const compilerOptions: Record<string, unknown> = {
        ...JAVASCRIPT_OPTIONS,
        jsx: STANDALONE_OPTIONS.jsx,
        noImplicitAny: planned.level === 'all',
    };
    const jsconfig: Record<string, unknown> = { compilerOptions };
    const isExtensionless = hasExtensionlessSources(planned, importStyle);
    const hasSourceSelection = isAuthoredSelection(authored, jsconfigOwner);
    if (!hasSourceSelection)
        jsconfig['include'] = JAVASCRIPT_EXTENSIONS.map((extension) => `${scopePrefix}**/*.${extension}`);
    if (authored === undefined) {
        Object.assign(compilerOptions, STANDALONE_OPTIONS, isExtensionless ? JAVASCRIPT_BUNDLED_IMPORTS : {});
        jsconfig['exclude'] = excluded;
        return JSON.stringify(jsconfig, null, JSON_INDENT);
    }
    jsconfig['extends'] = `${scopePrefix}${owner}`;
    if (authored.options.jsx !== undefined) delete compilerOptions['jsx'];
    jsconfig['exclude'] = buildExtendedExclude(
        planned,
        { owner: join(root, scopePath, owner), ignoredGlobs: excluded },
        authored,
    );
    if (jsconfigOwner === undefined) jsconfig['files'] = listTrackedDeclarationFiles(planned, authored);
    return JSON.stringify(jsconfig, null, JSON_INDENT);
}

export const JSCONFIG_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'javascript/jsconfig.json': buildJsconfigFile,
};
