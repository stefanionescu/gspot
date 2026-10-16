import { getValueAt } from '#cli/system/values.ts';
import { join, dirname, relative } from 'node:path';
import { findScope } from '#cli/repository/scopes.ts';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import { generatedIgnores } from '#cli/generation/ignore-files.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { JSCONFIG_FILE, TSCONFIG_FILE, SOURCE_SELECTION_FIELDS } from '#cli/config/parsers/tsconfig.ts';

import {
    JAVASCRIPT_IMPORTS,
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXCLUSIONS,
    JAVASCRIPT_EXTENSIONS,
    JAVASCRIPT_BUNDLED_IMPORTS,
} from '#cli/config/generation/typescript.ts';
/**
 * Build jsconfig from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the JavaScript type-checking project and its scoped source selectors.
 */
function buildJsconfig(context: ToolFileContext): string {
    const { root, reads } = context.session;
    const { files, targetPath: target } = context;
    const scope = context.selection.scope.path;
    const scopeEntries = context.scopes.map((entry) => entry.scope);
    const importStyle = context.selection.view.options('tools.eslint').import_extension;
    const declarationPaths = generatedIgnores(context.session);
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
            findScope(file.path, scopeEntries).path === scope,
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
    if (jsconfigOwner === undefined)
        jsconfig['files'] = authored.fileNames
            .filter((path) => DECLARATION_EXTENSIONS.has(extractExtension(path)))
            .map((path) => convertToPosixPath(relative(join(root, dirname(target)), path)));
    return JSON.stringify(jsconfig, null, JSON_INDENT) + '\n';
}

export { buildJsconfig };
