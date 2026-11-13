import { CLIENT_ENVIRONMENT_RULE } from '#cli/config/configurations/javascript/blocks.ts';
import { splitGlobs } from '#cli/configurations/language/javascript/eslint/files.ts';
import { listNestedScopeGlobs } from '#cli/configurations/language/javascript/eslint/scopes.ts';
import { listProjectDependencyNames } from '#cli/repository/projects/dependencies.ts';
import { joinScopeSelector } from '#cli/settings/values/paths.ts';
import { escapeGlob } from '#cli/system/patterns.ts';
import type { EslintRuleBlock } from '#cli/types/configurations/javascript.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import type { Scope } from '#cli/types/settings.ts';

function listManifestRuleBlocks(scope: Scope, excluded: string[], dependencyNames: string[]): EslintRuleBlock[] {
    const tables = scope.configurations.map(({ eslint }) => eslint);
    return [
        ...tables
            .flatMap(({ client_environment }) => client_environment)
            .filter(({ dependencies }) => dependencies.every((name) => dependencyNames.includes(name)))
            .map(({ files, public_prefixes, allowed_names }) => ({
                scopePath: scope.path,
                ...splitGlobs([...files.map((file) => joinScopeSelector(file, escapeGlob(scope.path))), ...excluded]),
                rules: {
                    [CLIENT_ENVIRONMENT_RULE]: [
                        'error',
                        {
                            client: true,
                            publicPrefixes: public_prefixes,
                            ...(allowed_names !== undefined && { allowedNames: allowed_names }),
                        },
                    ],
                },
            })),
        ...tables
            .flatMap(({ rules_off }) => rules_off)
            .map(({ files, rules }) => ({
                scopePath: scope.path,
                ...splitGlobs([...(files ?? ['**/*']), ...excluded]),
                rules: Object.fromEntries(rules.map((rule) => [rule, 'off'])),
            })),
    ];
}

export function buildManifestRuleBlocks(scopes: Scope[], dependencyFiles: DependencyFile[]): EslintRuleBlock[] {
    return scopes.flatMap((scope) =>
        listManifestRuleBlocks(
            scope,
            listNestedScopeGlobs(
                scopes.map((each) => each.path),
                scope.path,
            ).map((glob) => `!${glob}`),
            listProjectDependencyNames(dependencyFiles, scope.path),
        ),
    );
}
