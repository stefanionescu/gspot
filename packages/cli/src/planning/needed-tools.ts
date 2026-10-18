import { basename } from 'node:path';
import { findScope } from '#cli/repository/scopes.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { ESLINT_TOOL } from '#cli/config/generation/eslint.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { stripCoverageArguments } from '#cli/planning/checks.ts';
import { PIP_LICENSES_COMMAND } from '#cli/config/tools/python.ts';
import { PRETTIER_TOOL } from '#cli/config/generation/formatting.ts';
import { listSelectedManifests } from '#cli/configurations/select.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { LICENSE_CHECKER } from '#cli/config/checks/general/licenses.ts';
import type { StylelintComponent } from '#cli/types/generation/files.ts';
import { isSettingEmpty, findSettingsSkip } from '#cli/planning/skips.ts';
import type { PrettierPlugin } from '#cli/types/generation/formatting.ts';
import type { Settings, ScopeSelection } from '#cli/types/settings/values.ts';
import type { Session, PlannedCheck, LicenseProject } from '#cli/types/planning.ts';
import { getToolDeclaration, findToolProjectPackage } from '#cli/configurations/tools.ts';
import { FLAG_VALUE, COVERAGE_FLAGS, LICENSES_CONFIGURATION } from '#cli/config/planning.ts';
import type { Manifest, ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';

import {
    STYLELINT_TOOL,
    VUE_STYLELINT_OVERRIDE,
    SVELTE_STYLELINT_OVERRIDE,
} from '#cli/config/generation/tool-files.ts';

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
 * List the plugin tools that active formatter checks need.
 *
 * @param scopes every project selection.
 * @param programs the tools that the manifests declare.
 *
 * @returns the package names of the plugins.
 */
function listPrettierPluginNames(scopes: ScopeSelection[], programs: ReadonlySet<string>): string[] {
    return programs.has(PRETTIER_TOOL)
        ? [...listPrettierPlugins(scopes.flatMap(({ selected }) => selected)).keys()].map(({ name }) => name)
        : [];
}

// Add the packages that each tool package requires. A Set visits the names that the loop adds, too.
function addRequiredPackages(names: Set<string>, manifests: readonly Manifest[]): void {
    for (const name of names)
        for (const required of findToolProjectPackage(getToolDeclaration(manifests, name))?.requires ?? [])
            names.add(required);
}

/**
 * List the extra tools that the command and the configuration of a check use.
 *
 * @param scope where the check runs.
 * @param check the declaration to read.
 * @param command the arguments that run, if known.
 *
 * @returns each extra tool once.
 */
export function checkCompanions(scope: ScopeSelection, check: CheckDeclaration, command?: string[]): string[] {
    const manifest = scope.selected.find((owner) => owner.checks.includes(check));
    const gated = stripCoverageArguments(
        { selection: scope, check, ...(manifest === undefined ? {} : { manifest }) },
        {},
    );
    const withoutCoverage =
        gated !== check.command && command?.some((part) => COVERAGE_FLAGS.has(part.replace(FLAG_VALUE, ''))) !== true;
    const tools = new Set([
        check.tool,
        ...[check.command, check.fix].flatMap((commandArguments) =>
            commandArguments === undefined ? [] : [commandArguments[0]],
        ),
        ...(check.other_tools ?? []),
    ]);
    const companions = scope.selected
        .flatMap((manifest) => manifest.toolFiles)
        .filter((config) => config.tool.length === 0 || config.tool.some((name) => tools.has(name)))
        .filter((config) => config.check.length === 0 || config.check.includes(check.name))
        .filter((config) => config.when === undefined || scope.view.configurations.includes(config.when.configuration))
        .flatMap((config) => config.required_tools);
    // ESLint loads the packages of every configuration that adds a block to its tool file.
    const plugins = tools.has(ESLINT_TOOL)
        ? scope.selected
              .filter((manifest) => manifest.eslint.fragment)
              .flatMap((manifest) => manifest.eslint.required_tools)
        : [];
    const syntax =
        check.tool === STYLELINT_TOOL
            ? selectStylelintComponents(scope.view.configurations).map((dialect) => dialect.customSyntax)
            : [];
    return [...new Set([...(check.other_tools ?? []), ...companions, ...plugins, ...syntax])].filter((name) => {
        const pin = getToolDeclaration(scope.selected, name);
        if (!isToolSelected(scope, pin.when)) return false;
        if (!withoutCoverage) return true;
        return pin.system !== true || pin.kind !== 'library';
    });
}

/**
 * Read the executable, fixer, and extra tools that a check uses.
 *
 * @param check the plan with resolved conditions, scopes, and exclusions.
 *
 * @returns the tools to install.
 */
export function listRequiredTools(check: PlannedCheck): string[] {
    const names = new Set(
        [check.tool?.name, ...checkCompanions(check.selection, check.check), check.check.fix?.[0]].filter(
            (name) => name !== undefined,
        ),
    );
    addRequiredPackages(names, check.selection.selected);
    return [...names];
}

/**
 * List the configured checks of one scope: its own checks and the checks that run once for the repository.
 *
 * @param session the repository and its configured checks.
 * @param selection the scope.
 *
 * @returns the checks whose tools the scope needs.
 */
export function listScopeChecks(session: Session, selection: ScopeSelection): PlannedCheck[] {
    return session.configuredChecks.filter(
        (planned) => planned.selection.scope.path === selection.scope.path || planned.check.runs === 'once',
    );
}

/**
 * Select the tools that checks, fixers, and their tool files use.
 * The selection covers every supported system, so committed output does not depend on this machine.
 *
 * @param session the repository and its settings.
 * @param checks the plans for every supported system.
 *
 * @returns the manifests with only the tools they need.
 */
export function selectNeededManifests(session: Session, checks: PlannedCheck[]): Manifest[] {
    const licenses = checks
        .filter((entry) => entry.manifest?.configuration.name === LICENSES_CONFIGURATION)
        .flatMap((check) =>
            listLicenseProjects(check.files, session.scopes, session.settingsFile.settings, check.check),
        )
        .filter((project) => project.skip === undefined)
        .map((project) =>
            basename(project.dependencyFile) === PACKAGE_JSON ? LICENSE_CHECKER : PIP_LICENSES_COMMAND[0],
        );
    const needed = new Set([...checks.flatMap((check) => listRequiredTools(check)), ...licenses]);
    for (const name of listPrettierPluginNames(session.scopes, needed)) needed.add(name);
    const selected = listSelectedManifests(session.scopes);
    const selectedTools = new Set(selected.flatMap((manifest) => manifest.tools.map(({ name }) => name)));
    addRequiredPackages(needed, [...session.manifests.values()]);
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
 * Select each project with its license settings and authored scope.
 *
 * @param files the inventory that the check reads.
 * @param scopes every scope.
 * @param settings the validated gspot.toml.
 * @param check the license declaration.
 *
 * @returns the projects that need installed license reports.
 */
export function listLicenseProjects(
    files: TrackedFile[],
    scopes: ScopeSelection[],
    settings: Settings,
    check: CheckDeclaration,
): LicenseProject[] {
    const entries = scopes.map((selection) => selection.scope);
    return scopes.flatMap((selection) =>
        files
            .filter(
                (file) => !isInGspotFolder(file.path) && findScope(file.path, entries).path === selection.scope.path,
            )
            .flatMap((file) => {
                if (
                    !selection.selected.some(
                        (manifest) =>
                            manifest.configuration.name === LICENSES_CONFIGURATION &&
                            listCoveredFiles(check.files ?? manifest.files, [file], {
                                selected: selection.selected,
                                scope: selection.scope.path,
                                view: selection.view,
                            }).length > 0,
                    )
                )
                    return [];
                const options = selection.view.options('licenses');
                const configuration = { allowed: options.allowed, allowed_package: options.allowed_package };
                return configuration.allowed.length === 0 && configuration.allowed_package.length === 0
                    ? []
                    : [
                          {
                              dependencyFile: file.path,
                              selection,
                              configuration,
                              skip: findSettingsSkip(settings, selection, check),
                          },
                      ];
            }),
    );
}

/**
 * Resolve the formatter plugins once, and keep their declarations and npm entries.
 *
 * @param manifests the configurations in use.
 *
 * @returns the plugins and their module paths.
 */
export function listPrettierPlugins(manifests: Iterable<Manifest>): Map<ToolDeclaration, PrettierPlugin> {
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
 * List the component dialects that Stylelint reads, and the parser that each needs.
 *
 * @param configurations the configuration names in use.
 *
 * @returns the dialects and their parser declarations.
 */
export function selectStylelintComponents(configurations: string[]): StylelintComponent[] {
    return [
        ...(configurations.includes('vue') ? [VUE_STYLELINT_OVERRIDE] : []),
        ...(configurations.includes('svelte') ? [SVELTE_STYLELINT_OVERRIDE] : []),
    ];
}
