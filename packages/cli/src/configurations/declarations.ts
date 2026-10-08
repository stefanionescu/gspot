// Validated configuration declarations and their shipped rule assets.
import { posix } from 'node:path';
import { listAssets } from '#cli/platform/assets.ts';
import type { FileDeclaration } from '#cli/types/repository/inventory.ts';
import { CONFIG_PREFIX, CONFIGURATION_RULES_FOLDER } from '#cli/config/configurations.ts';
import type { Manifest, OwnedCheck, RuleSource, ConfigurationFile } from '#cli/types/configurations.ts';

/**
 * Every declared check by ID, with the configuration that ships it. Borrowed checks retain their original owner.
 * @param manifests the manifests to index
 * @returns the declared checks by ID
 */
export function allChecks(manifests: Iterable<Manifest>): Map<string, OwnedCheck> {
    const checks = new Map<string, OwnedCheck>();
    for (const manifest of manifests) {
        const owned = manifest.checks.filter((check) => !manifest.configuration.borrowed_checks.includes(check.name));
        for (const check of owned) {
            if (checks.has(check.name)) throw new Error(`Duplicate check identity: ${check.name}`);
            checks.set(check.name, { check, configuration: manifest });
        }
    }
    return checks;
}

/**
 * The repository-relative path of a config file generated for a scope.
 * @param scope the scope path, empty for the root
 * @param config the config-file declaration
 * @returns the path of the generated config file
 */
export function targetInScope(scope: string, config: ConfigurationFile): string {
    if (scope === '' || !config.scoped) return config.target;
    if (config.target.startsWith(CONFIG_PREFIX))
        return posix.join(CONFIG_PREFIX, scope, config.target.slice(CONFIG_PREFIX.length));
    return `${scope}/${config.target}`;
}

/**
 * The name a `{tool_file:<name>}` placeholder uses for a config file.
 * @param target the target path
 * @returns the file name under .gspot/config without its extensions
 */
export function configurationName(target: string): string {
    const bare = target.startsWith(CONFIG_PREFIX) ? target.slice(CONFIG_PREFIX.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}

/**
 * The files of a configuration's rules folder. Each installs under the configuration's category and name, as language/bash/BASH.md.
 * @param manifest the configuration
 * @returns each file with its path inside the rules folder
 */
export function configurationFiles(manifest: Manifest): RuleSource[] {
    const { kind, name } = manifest.configuration;
    const sources = listAssets(`${manifest.dir}/${CONFIGURATION_RULES_FOLDER}/`);
    return sources.map((source) => ({
        source,
        path: `${kind}/${name}/${posix.relative(manifest.dir + '/' + CONFIGURATION_RULES_FOLDER, source)}`,
    }));
}

/**
 * Resolve authored declarations and generated paths of the configurations each scope selects.
 * @param declarations the authored file declarations
 * @param selected the actual manifests selected by each authored scope
 * @returns file declarations with internal configuration origins retained
 */
export function fileDeclarations(
    declarations: FileDeclaration[],
    selected: Map<string, Manifest[]>,
): FileDeclaration[] {
    return [
        ...declarations.filter((entry) => entry.kind !== 'generated' || entry.configuration === undefined),
        ...selected.entries().flatMap(([path, manifests]) =>
            manifests.flatMap(({ generated, configuration }) =>
                generated.length === 0
                    ? []
                    : [
                          {
                              kind: 'generated' as const,
                              configuration: configuration.name,
                              paths: generated.map((file) => posix.join(path, file)),
                          },
                      ],
            ),
        ),
    ];
}
