import { basename } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { coveredBy } from '#cli/repository/select.ts';
import { coverageArguments } from '#cli/planning/checks.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { isInGspotFolder } from '#cli/repository/selectors.ts';
import { PIP_LICENSES_COMMAND } from '#cli/config/tools/python.ts';
import { PRETTIER_TOOL } from '#cli/config/generation/formatting.ts';
import { settingsSkip, isSettingEmpty } from '#cli/planning/skips.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { LICENSE_CHECKER } from '#cli/config/checks/general/licenses.ts';
import type { StylelintComponent } from '#cli/types/generation/eslint.ts';
import type { PrettierPlugin } from '#cli/types/generation/formatting.ts';
import type { Settings, ScopeSelection } from '#cli/types/settings/values.ts';
import type { Session, PlannedCheck, LicenseProject } from '#cli/types/planning.ts';
import { toolDeclaration, toolProjectPackage } from '#cli/configurations/tool-pins.ts';
import type { Manifest, ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';

import {
    FLAG_VALUE,
    COVERAGE_FLAGS,
    STYLELINT_TOOL,
    VUE_STYLELINT_OVERRIDE,
    LICENSES_CONFIGURATION,
    SVELTE_STYLELINT_OVERRIDE,
} from '#cli/config/planning.ts';

function isToolSelected(scope: ScopeSelection, conditions: ToolDeclaration['when']): boolean {
    return (
        conditions === undefined ||
        conditions.some((condition) => {
            if (condition.level !== undefined && condition.level !== scope.view.settings['level']) return false;
            if (condition.setting === undefined) return true;
            return !isSettingEmpty(scope.view.settings[condition.setting]);
        })
    );
}

/**
 * The selected plugin tools that active formatter checks require.
 *
 * @param scopes the selected project scopes.
 * @param programs the declared program installations.
 *
 * @returns the package names required by active formatter plugins.
 */
function prettierToolRequirements(scopes: ScopeSelection[], programs: ReadonlySet<string>): string[] {
    return programs.has(PRETTIER_TOOL)
        ? [...prettierPlugins(scopes.flatMap(({ selected }) => selected)).keys()].map(({ name }) => name)
        : [];
}

/**
 * Companion tools consumed by a check's command and its selected configuration.
 *
 * @param scope the effective configuration selection.
 * @param check the declared check.
 * @param command the argv actually executed when supplied.
 *
 * @returns each explicit and configuration-owned companion once.
 */
export function checkCompanions(scope: ScopeSelection, check: CheckDeclaration, command?: string[]): string[] {
    const manifest = scope.selected.find((owner) => owner.checks.includes(check));
    const gated = coverageArguments({ scope, check, ...(manifest === undefined ? {} : { manifest }) }, {});
    const withoutCoverage =
        gated !== check.command && command?.some((part) => COVERAGE_FLAGS.has(part.replace(FLAG_VALUE, ''))) !== true;
    const tools = new Set([
        check.tool,
        ...[check.command, check.fix].flatMap((argv) => (argv === undefined ? [] : [argv[0]])),
        ...(check.other_tools ?? []),
    ]);
    const companions = scope.selected
        .flatMap((manifest) => manifest.toolFiles)
        .filter((config) => config.tool.length === 0 || config.tool.some((name) => tools.has(name)))
        .filter((config) => config.check.length === 0 || config.check.includes(check.name))
        .filter((config) => config.when === undefined || scope.view.configurations.includes(config.when.configuration))
        .flatMap((config) => config.required_tools);
    const syntax =
        check.tool === STYLELINT_TOOL
            ? stylelintComponents(scope.view.configurations).map((dialect) => dialect.customSyntax)
            : [];
    return [...new Set([...(check.other_tools ?? []), ...companions, ...syntax])].filter((name) => {
        const pin = toolDeclaration(scope.selected, name);
        if (!isToolSelected(scope, pin.when)) return false;
        if (!withoutCoverage) return true;
        return pin.system !== true || pin.kind !== 'library';
    });
}

/**
 * Read executable, fixer, and companion tools consumed by an applicable check.
 *
 * @param check the check with its conditions, scopes, and exclusions resolved.
 *
 * @returns required executable, declared peer, and installation tools.
 */
export function requiredToolNames(check: PlannedCheck): string[] {
    const names = new Set(
        [check.tool?.name, ...checkCompanions(check.scope, check.check), check.check.fix?.[0]].filter(
            (name) => name !== undefined,
        ),
    );
    for (const name of names)
        for (const required of new Set(toolProjectPackage(toolDeclaration(check.scope.selected, name))?.requires))
            names.add(required);
    return [...names];
}

/**
 * Select tool declarations consumed by applicable checks, fixers, and their generated tool files.
 * Requirements include supported platforms so committed output does not depend on the current host.
 *
 * @param session the saved settings and repository inventory.
 * @param checks the checks already planned across supported systems.
 *
 * @returns the selected manifests with only their required tools.
 */
export function neededToolManifests(session: Session, checks: PlannedCheck[]): Manifest[] {
    const licenses = checks
        .filter((entry) => entry.manifest?.configuration.name === LICENSES_CONFIGURATION)
        .flatMap((check) => licenseProjects(check.files, session.scopes, session.settingsFile.settings, check.check))
        .filter((project) => project.skip === undefined)
        .map((project) => (basename(project.manifest) === PACKAGE_JSON ? LICENSE_CHECKER : PIP_LICENSES_COMMAND[0]));
    const needed = new Set([...checks.flatMap((check) => requiredToolNames(check)), ...licenses]);
    for (const name of prettierToolRequirements(session.scopes, needed)) needed.add(name);
    const selected = everyManifest(session.scopes);
    const selectedTools = new Set(selected.flatMap((manifest) => manifest.tools.map(({ name }) => name)));
    for (const name of needed)
        for (const required of toolProjectPackage(toolDeclaration(session.manifests.values(), name))?.requires ?? [])
            needed.add(required);
    const extras = [...needed].flatMap((name) =>
        selectedTools.has(name)
            ? []
            : [...session.manifests.values()]
                  .filter((manifest) => manifest.tools.some((tool) => tool.name === name))
                  .slice(0, 1),
    );
    const owners = new Set([...selected, ...extras]);
    return [...owners].map((manifest) => ({
        ...manifest,
        tools: manifest.tools
            .filter(({ when: conditions }) => session.scopes.some((scope) => isToolSelected(scope, conditions)))
            .filter((tool) => needed.has(tool.name)),
    }));
}

/**
 * Select each consumer project with its effective license settings and authored scope.
 *
 * @param files the check's actual repository inventory.
 * @param scopes the existing effective selections.
 * @param settings the validated repository settings.
 * @param check the license check declaration.
 *
 * @returns the consumer projects that require installed license reports.
 */
export function licenseProjects(
    files: TrackedFile[],
    scopes: ScopeSelection[],
    settings: Settings,
    check: CheckDeclaration,
): LicenseProject[] {
    const entries = scopes.map((selection) => selection.scope);
    return scopes.flatMap((selection) =>
        files
            .filter((file) => !isInGspotFolder(file.path) && scopeOf(file.path, entries).path === selection.scope.path)
            .flatMap((file) => {
                if (
                    !selection.selected.some(
                        (manifest) =>
                            manifest.configuration.name === LICENSES_CONFIGURATION &&
                            coveredBy(
                                check.files ?? manifest.files,
                                selection.selected,
                                [file],
                                selection.scope.path,
                                selection.view.test_files,
                                selection.view.settings,
                            ).length > 0,
                    )
                )
                    return [];
                const options = selection.view.options('licenses');
                const configuration = { allowed: options.allowed, allowed_package: options.allowed_package };
                return configuration.allowed.length === 0 && configuration.allowed_package.length === 0
                    ? []
                    : [
                          {
                              manifest: file.path,
                              selection,
                              configuration,
                              skip: settingsSkip(settings, selection, check),
                          },
                      ];
            }),
    );
}

/**
 * Resolve the selected formatter plugins once. Retain their declaration identities and npm entries.
 *
 * @param manifests the selected configuration manifests.
 *
 * @returns the selected formatter plugins and their module paths.
 */
export function prettierPlugins(manifests: Iterable<Manifest>): Map<ToolDeclaration, PrettierPlugin> {
    return new Map(
        [...manifests].flatMap(({ tools }) =>
            tools.flatMap((tool): [ToolDeclaration, PrettierPlugin][] => {
                const name = tool.installers['npm']?.name;
                return tool.prettier === undefined || name === undefined
                    ? []
                    : [[tool, { name, entry: tool.prettier.entry, overrides: tool.prettier.overrides }]];
            }),
        ),
    );
}

/**
 * The component dialects Stylelint reads and the parser each requires.
 *
 * @param configurations the selected configuration names.
 *
 * @returns the selected component dialects and their parser declarations.
 */
export function stylelintComponents(configurations: string[]): StylelintComponent[] {
    return [
        ...(configurations.includes('vue') ? [VUE_STYLELINT_OVERRIDE] : []),
        ...(configurations.includes('svelte') ? [SVELTE_STYLELINT_OVERRIDE] : []),
    ];
}
