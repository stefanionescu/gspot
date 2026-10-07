import { valueAt } from '#cli/platform/objects.ts';
import { join, dirname, relative } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { getTsconfig } from '#cli/parsers/tsconfig.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { toPosix, extensionOf } from '#cli/platform/paths.ts';
import { generatedIgnores } from '#cli/generation/ignore-patterns.ts';
import type { JsconfigInput } from '#cli/types/generation/jsconfig.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';

import {
    JAVASCRIPT_IMPORTS,
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXCLUSIONS,
    JAVASCRIPT_EXTENSIONS,
    JAVASCRIPT_BUNDLED_IMPORTS,
} from '#cli/config/generation/typescript.ts';

/**
 * Generates JavaScript compiler settings using the scope's authored resolution and input selection.
 * @param input the source inventory, import styles and authored project paths of one scope
 * @returns the jsconfig contents
 */
export function buildJsconfig(input: JsconfigInput): Record<string, unknown> {
    const { root, reads, declarationPaths, target, scope, files, scopeEntries, importStyles } = input;
    const jsconfigOwner = getTsconfig(root, join(root, scope, 'jsconfig.json'), reads);
    const owner = jsconfigOwner === undefined ? 'tsconfig.json' : 'jsconfig.json';
    const authored = jsconfigOwner ?? getTsconfig(root, join(root, scope, owner), reads);
    const prefix = toPosix(relative(dirname(target), scope)) + '/';
    const compilerOptions: Record<string, unknown> = { ...JAVASCRIPT_OPTIONS, ['jsx']: JAVASCRIPT_IMPORTS.jsx };
    const jsconfig: Record<string, unknown> = { compilerOptions };
    const extensionless = Object.entries(importStyles).some(
        ([glob, style]) =>
            style === 'extensionless' &&
            files.some(
                (file) =>
                    file.kind === 'source' &&
                    file.tags.includes('javascript') &&
                    scopeOf(file.path, scopeEntries).path === scope &&
                    pathMatcher([glob])(file.path),
            ),
    );
    const hasSourceSelection = ['files', 'include'].some((field) => valueAt(jsconfigOwner?.raw, [field]) !== undefined);
    if (!hasSourceSelection)
        jsconfig['include'] = JAVASCRIPT_EXTENSIONS.map((extension) => `${prefix}**/*.${extension}`);
    if (authored === undefined) {
        Object.assign(compilerOptions, JAVASCRIPT_IMPORTS, extensionless ? JAVASCRIPT_BUNDLED_IMPORTS : {});
        jsconfig['exclude'] = generatedIgnores(declarationPaths, JAVASCRIPT_EXCLUSIONS).map(
            (path) => `${prefix}${path}`,
        );
        return jsconfig;
    }
    jsconfig['extends'] = `${prefix}${owner}`;
    if (authored.options.jsx !== undefined) delete compilerOptions['jsx'];
    if (jsconfigOwner === undefined)
        jsconfig['files'] = authored.fileNames
            .filter((path) => DECLARATION_EXTENSIONS.includes(extensionOf(path)))
            .map((path) => toPosix(relative(join(root, dirname(target)), path)));
    return jsconfig;
}
