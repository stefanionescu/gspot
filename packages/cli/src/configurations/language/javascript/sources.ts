import {
    CODE_LANGUAGES,
    COMPONENT_CONFIGURATIONS,
    MISE_TASKS_GLOB,
} from '#cli/config/configurations/javascript/projects.ts';
import { EXTENSION_PATTERN } from '#cli/config/manifests.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { listTaggedExtensions } from '#cli/repository/files/tags.ts';
import { joinScopeGlob } from '#cli/repository/scopes.ts';
import { extractExtension } from '#cli/system/paths.ts';
import type { Scope } from '#cli/types/settings.ts';

export function listJavascriptScopes(scopes: Scope[]): Scope[] {
    return scopes.filter(({ settings }) => settings.configurations.includes(JAVASCRIPT_CONFIGURATION));
}

export function listScriptFiles(scope: Pick<Scope, 'path' | 'settings'>): string[] {
    return [...(scope.settings.tables.javascript?.script_files ?? []), joinScopeGlob(scope.path, MISE_TASKS_GLOB)];
}

export function listCodePatterns(patterns: string[]): string[] {
    const extensions = listTaggedExtensions(...CODE_LANGUAGES, ...COMPONENT_CONFIGURATIONS, 'astro');
    return patterns.filter((pattern) => {
        const extension = extractExtension(pattern);
        return extension === '' || !EXTENSION_PATTERN.test(extension) || extensions.includes(extension);
    });
}

export function listExternals(scopes: Scope[]): string[] {
    return [...new Set(scopes.flatMap(({ settings }) => settings.tables.javascript?.externals ?? []))];
}
