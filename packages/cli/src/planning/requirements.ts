// Tool requirements derived from the same applicable check plan used by execution.
import { scopeOf } from '#cli/repository/scopes.ts';
import { ownedBy } from '#cli/configurations/owners.ts';
import { configuredChecks } from '#cli/planning/plan.ts';
import { selectionStatus } from '#cli/planning/skips.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { isToolProjectPath } from '#cli/repository/selectors.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { declaredArchitectures } from '#cli/policy/settings/lookup.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import type { Session, PlannedCheck, LicenseProject } from '#cli/types/planning.ts';
import { toolPin, checkToolPin, toolProjectPackage } from '#cli/configurations/pins.ts';

/**
 * Companion tools consumed by a check's command and its selected native configuration.
 * @param scope the effective configuration selection
 * @param check the declared check
 * @returns each explicit and configuration-owned companion once
 */
export function checkCompanions(scope: ScopeSelection, check: CheckDeclaration): string[] {
    const tools = new Set([check.tool, check.command?.[0], check.fix?.[0], ...(check.other_tools ?? [])]);
    const companions = scope.selected
        .flatMap((manifest) => manifest.configs)
        .filter((config) => config.tool.length === 0 || config.tool.some((name) => tools.has(name)))
        .filter((config) => config.check.length === 0 || config.check.includes(check.name))
        .filter((config) => config.when === undefined || scope.view.configurations.includes(config.when.configuration))
        .flatMap((config) => config.required_tools);
    return [...new Set([...(check.other_tools ?? []), ...companions])];
}

/**
 * Select each consumer project with its effective license policy and authored scope.
 * @param files the check's actual repository inventory.
 * @param scopes the existing effective selections.
 * @param policy the validated repository policy.
 * @param check the license check declaration.
 * @returns the consumer projects that require installed license reports.
 */
export function licenseProjects(
    files: TrackedFile[],
    scopes: ScopeSelection[],
    policy: Policy,
    check: CheckDeclaration,
): LicenseProject[] {
    return files.flatMap((file) => {
        if (isToolProjectPath(file.path)) return [];
        const scope = scopeOf(
            file.path,
            scopes.map((selection) => selection.scope),
        );
        const selection = scopes.find((entry) => entry.scope.path === scope.path);
        if (selection === undefined) throw new Error(`No selection covers the scope ${scope.path}.`);
        if (
            !selection.selected.some(
                (manifest) =>
                    manifest.configuration.name === 'licenses' &&
                    ownedBy(check.files ?? manifest.files, selection.selected, [file], selection.scope.path).length > 0,
            )
        )
            return [];
        const configuration = selection.view.options('licenses');
        return configuration.allowed.length === 0 && Object.keys(configuration.exceptions).length === 0
            ? []
            : [{ manifest: file.path, selection, configuration, skip: selectionStatus(policy, selection, check) }];
    });
}

/**
 * Read executable, fixer, and companion tools consumed by an applicable check.
 * @param check the check with its conditions, scopes, and exclusions resolved
 * @param session the effective scope selections and installation integration.
 * @returns required tool names, including manifest-specific scanner branches
 */
export function requiredToolNames(check: PlannedCheck, session: Pick<Session, 'scopes' | 'policyFiles'>): string[] {
    const runner = session.policyFiles.policy.runner;
    const names = new Set(
        [check.tool?.name, ...checkCompanions(check.scope, check.check), check.check.fix?.[0]].flatMap((name) => {
            if (name === undefined) return [];
            // v8r loads Ajv through an optional peer in tool project installations.
            if (name === 'v8r' && toolProjectPackage(toolPin(check.scope.selected, name), runner)?.kind === 'npm')
                return [name, 'ajv'];
            return [name];
        }),
    );
    if (check.check.name === 'licenses/packages') {
        const projects = licenseProjects(check.files, session.scopes, session.policyFiles.policy, check.check).filter(
            ({ skip }) => skip === undefined,
        );
        if (projects.some(({ manifest }) => manifest.endsWith('package.json')))
            names.add('license-checker-rseidelsohn');
        if (projects.some(({ manifest }) => manifest.endsWith('pyproject.toml'))) names.add('pip-licenses');
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
    const architectures = declaredArchitectures(session.scopes);
    const needed = new Set(checks.flatMap((check) => requiredToolNames(check, session)));
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
                .filter((tool) => tool.name !== 'eslint-plugin-boundaries' || architectures.length > 0)
                .filter(
                    (tool) =>
                        needed.has(tool.name) ||
                        (ownsEslint && (tool.kind === 'library' || tool.name === 'eslint-config-prettier')) ||
                        (ownsPrettier && tool.prettier !== undefined),
                )
                .map((tool) => {
                    let pin = tool;
                    for (const check of checks) pin = checkToolPin(pin, check.check);
                    return pin;
                }),
        };
    });
}
