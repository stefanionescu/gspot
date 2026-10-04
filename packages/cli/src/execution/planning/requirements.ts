// Tool requirements derived from the same applicable check plan used by execution.
import { toolPin } from '#cli/tools/pins.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { configuredChecks } from '#cli/execution/planning/plan.ts';
import type { PlannedCheck } from '#cli/types/execution/runtime.ts';
import { privateToolInstallation } from '#cli/tools/installation.ts';

/**
 * Read executable, fixer, and companion tools consumed by an applicable check.
 * @param check the check with its conditions, scopes, and exclusions resolved
 * @param runner the declared installation integration
 * @returns required tool names, including manifest-specific scanner branches
 */
export function requiredToolNames(check: PlannedCheck, runner: string | undefined): string[] {
    const names = new Set(
        [check.tool?.name, ...(check.spec.other_tools ?? []), check.spec.fix?.[0]].flatMap((name) => {
            if (name === undefined) return [];
            // v8r loads Ajv through an optional peer in private installations.
            if (name === 'v8r' && privateToolInstallation(toolPin(check.scope.selected, name), runner)?.kind === 'npm')
                return [name, 'ajv'];
            return [name];
        }),
    );
    if (check.spec.name === 'licenses/packages') {
        if (check.files.some((file) => file.path.endsWith('package.json'))) names.add('license-checker-rseidelsohn');
        if (check.files.some((file) => file.path.endsWith('pyproject.toml'))) names.add('pip-licenses');
    }
    if ([...names].some((name) => privateToolInstallation(toolPin(check.scope.selected, name), runner)?.kind === 'npm'))
        names.add('node');
    return [...names];
}

/**
 * Select tool declarations consumed by applicable checks, fixers, and their generated configuration.
 * Requirements include supported platforms so committed output does not depend on the current host.
 * @param session the saved policy and repository inventory
 * @returns the selected manifests with only their required tools
 */
export function applicableManifests(session: Session): Manifest[] {
    const checks = configuredChecks(session, true);
    const needed = new Set(checks.flatMap((check) => requiredToolNames(check, session.policyFiles.policy.run_with)));
    const selected = everyManifest(session.scopes);
    const owners = new Set(selected);
    for (const name of needed) {
        if (selected.some((manifest) => manifest.tools.some((tool) => tool.name === name))) continue;
        const owner = session.manifests.values().find((manifest) => manifest.tools.some((tool) => tool.name === name));
        if (owner !== undefined) owners.add(owner);
    }
    return [...owners].map((manifest) => {
        const consumers = checks.filter((check) => check.scope.selected.includes(manifest));
        const ownsEslint =
            consumers.some((check) => check.tool?.name === 'eslint') &&
            manifest.configs.some((config) => config.target.includes('eslint'));
        const ownsPrettier = needed.has('prettier') && manifest.tools.some((tool) => tool.prettier !== undefined);
        return {
            ...manifest,
            tools: manifest.tools.filter(
                (tool) =>
                    needed.has(tool.name) ||
                    (ownsEslint && (tool.kind === 'library' || tool.name === 'eslint-config-prettier')) ||
                    (ownsPrettier && tool.prettier !== undefined),
            ),
        };
    });
}
