// Tool requirements derived from the same applicable check plan used by execution.
import { configuredChecks } from '#cli/planning/plan.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { declaredArchitectures } from '#cli/policy/settings/lookup.ts';
import type { Manifest, CheckSpec } from '#cli/types/configurations.ts';
import { toolPin, checkToolPin, toolProjectPackage } from '#cli/configurations/pins.ts';

/**
 * Companion tools consumed by a check's command and its selected native configuration.
 * @param scope the effective configuration selection
 * @param spec the declared check
 * @returns each explicit and configuration-owned companion once
 */
export function checkCompanions(scope: ScopeSelection, spec: CheckSpec): string[] {
    const tools = new Set([spec.tool, spec.command?.[0], spec.fix?.[0], ...(spec.other_tools ?? [])]);
    const companions = scope.selected
        .flatMap((manifest) => manifest.configs)
        .filter((config) => config.tool.length === 0 || config.tool.some((name) => tools.has(name)))
        .filter((config) => config.check.length === 0 || config.check.includes(spec.name))
        .filter((config) => config.when === undefined || scope.view.configurations.includes(config.when.configuration))
        .flatMap((config) => config.required_tools);
    return [...new Set([...(spec.other_tools ?? []), ...companions])];
}

/**
 * Read executable, fixer, and companion tools consumed by an applicable check.
 * @param check the check with its conditions, scopes, and exclusions resolved
 * @param runner the declared installation integration
 * @returns required tool names, including manifest-specific scanner branches
 */
export function requiredToolNames(check: PlannedCheck, runner: string | undefined): string[] {
    const names = new Set(
        [check.tool?.name, ...checkCompanions(check.scope, check.spec), check.spec.fix?.[0]].flatMap((name) => {
            if (name === undefined) return [];
            // v8r loads Ajv through an optional peer in tool project installations.
            if (name === 'v8r' && toolProjectPackage(toolPin(check.scope.selected, name), runner)?.kind === 'npm')
                return [name, 'ajv'];
            return [name];
        }),
    );
    if (check.spec.name === 'licenses/packages') {
        if (check.files.some((file) => file.path.endsWith('package.json'))) names.add('license-checker-rseidelsohn');
        if (check.files.some((file) => file.path.endsWith('pyproject.toml'))) names.add('pip-licenses');
    }
    if ([...names].some((name) => toolProjectPackage(toolPin(check.scope.selected, name), runner)?.kind === 'npm'))
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
    const architectures = declaredArchitectures(session.policyFiles.policy, session.scopes);
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
            tools: manifest.tools
                .filter(
                    (tool) =>
                        (tool.name !== '@eslint-community/eslint-plugin-eslint-comments' ||
                            session.policyFiles.policy.require_reasons) &&
                        (tool.name !== 'eslint-plugin-boundaries' || architectures.length > 0),
                )
                .filter(
                    (tool) =>
                        needed.has(tool.name) ||
                        (ownsEslint && (tool.kind === 'library' || tool.name === 'eslint-config-prettier')) ||
                        (ownsPrettier && tool.prettier !== undefined),
                )
                .map((tool) => {
                    let pin = tool;
                    for (const check of checks) pin = checkToolPin(pin, check.spec);
                    return pin;
                }),
        };
    });
}
