import { getValueAt } from '#cli/system/values.ts';
import { join, dirname, relative } from 'node:path';
import { findScope } from '#cli/repository/scopes.ts';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import { IGNORE_SECTION_TITLES } from '#cli/config/generation/ignore-files.ts';
import { buildGlobSections, buildIgnoreSections } from '#cli/generation/ignore-files.ts';
import { JSCONFIG_FILE, TSCONFIG_FILE, SOURCE_SELECTION_FIELDS } from '#cli/config/parsers/tsconfig.ts';

import {
    JAVASCRIPT_IMPORTS,
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXCLUSIONS,
    JAVASCRIPT_EXTENSIONS,
    JAVASCRIPT_BUNDLED_IMPORTS,
} from '#cli/config/generation/typescript.ts';

// An exclude here replaces the inherited one and the compiler defaults, so it repeats the authored entries. TypeScript
// takes the exclude of the nearest file in the extends chain, relative to that file.
function buildExtendedExclude(
    context: ToolFileContext,
    paths: { prefix: string; owner: string; exclusions: string[] },
    authored: TypeScriptConfiguration,
): string[] {
    const { root, reads } = context.session;
    const generatedFolder = join(root, dirname(context.targetPath));
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
    return [...paths.exclusions.map((path) => `${paths.prefix}${path}`), ...inherited];
}

// Only tracked declaration files: a gitignored one, such as a dev server's route types, differs per machine.
function listTrackedDeclarations(context: ToolFileContext, authored: TypeScriptConfiguration): string[] {
    const { root } = context.session;
    const tracked = new Set(context.session.repository.files.map((file) => file.path));
    return authored.fileNames
        .filter(
            (path) =>
                DECLARATION_EXTENSIONS.includes(extractExtension(path)) &&
                tracked.has(convertToPosixPath(relative(root, path))),
        )
        .map((path) => convertToPosixPath(relative(join(root, dirname(context.targetPath)), path)));
}

/**
 * Build the jsconfig file from the settings.
 *
 * @param context the tool file to build.
 * @returns the JavaScript type-checking project and its scoped source selectors.
 */
function buildJsconfig(context: ToolFileContext): string {
    const { root, reads } = context.session;
    const { targetPath: target } = context;
    const { files } = context.session.repository;
    const scope = context.selection.scope.path;
    const scopes = context.session.scopes.map((entry) => entry.scope);
    const importStyle = context.selection.view.options('tools.eslint').import_extension;
    const declarationPaths = buildGlobSections(
        buildIgnoreSections(context.session).filter(
            (section) =>
                context.session.settingsFile.settings.level !== 'all' || section.title !== IGNORE_SECTION_TITLES.build,
        ),
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
            findScope(file.path, scopes).path === scope,
    );
    const hasSourceSelection = SOURCE_SELECTION_FIELDS.some(
        (field) => getValueAt(jsconfigOwner?.raw, [field]) !== undefined,
    );
    if (!hasSourceSelection)
        jsconfig['include'] = JAVASCRIPT_EXTENSIONS.map((extension) => `${prefix}**/*.${extension}`);
    if (authored === undefined) {
        Object.assign(compilerOptions, JAVASCRIPT_IMPORTS, extensionless ? JAVASCRIPT_BUNDLED_IMPORTS : {});
        jsconfig['exclude'] = [...declarationPaths, ...JAVASCRIPT_EXCLUSIONS].map((path) => `${prefix}${path}`);
        return JSON.stringify(jsconfig, null, JSON_INDENT) + '\n';
    }
    jsconfig['extends'] = `${prefix}${owner}`;
    if (authored.options.jsx !== undefined) delete compilerOptions['jsx'];
    jsconfig['exclude'] = buildExtendedExclude(
        context,
        { prefix, owner: join(root, scope, owner), exclusions: [...declarationPaths, ...JAVASCRIPT_EXCLUSIONS] },
        authored,
    );
    if (jsconfigOwner === undefined) jsconfig['files'] = listTrackedDeclarations(context, authored);
    return JSON.stringify(jsconfig, null, JSON_INDENT) + '\n';
}

export { buildJsconfig };
