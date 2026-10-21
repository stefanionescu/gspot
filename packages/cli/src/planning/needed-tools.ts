import { basename } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { getTable } from '#cli/settings/scope-settings.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import { listCoveredFiles } from '#cli/repository/covered-files.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { PRETTIER_TOOL, STYLELINT_TOOL } from '#cli/config/planning.ts';
import { isSettingEmpty, findSettingsSkip } from '#cli/planning/skips.ts';
import type { PrettierPlugin } from '#cli/types/generation/formatting.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import type { PlannedCheck, LicenseProject } from '#cli/types/planning.ts';
import { isCoverageOff, hasCoverageArguments } from '#cli/planning/checks.ts';
import type { Tool, Check, Configuration } from '#cli/types/configurations.ts';
import { ESLINT_TOOL, LICENSES_CONFIGURATION } from '#cli/config/configurations.ts';
import { getTool, findToolProjectPackage } from '#cli/configurations/declared-tools.ts';
import { STYLELINT_COMPONENTS } from '#cli/config/generation/settings/builders/stylelint.ts';
import { PIP_LICENSES_COMMAND, LICENSE_CHECKER_COMMAND } from '#cli/config/checks/licenses.ts';

function isToolConditionMet(scope: Scope, conditions: Tool['when']): boolean {
    return (
        conditions === undefined ||
        conditions.some((condition) => {
            if (condition.level !== undefined && condition.level !== scope.settings.settings['level']) return false;
            if (condition.setting === undefined) return true;
            return !isSettingEmpty(scope.settings.settings[condition.setting]);
        })
    );
}

// Add the packages that each tool package requires. A Set visits the names that the loop adds, too.
function addPeerPackages(names: Set<string>, configurations: readonly Configuration[]): void {
    for (const name of names)
        for (const required of findToolProjectPackage(getTool(configurations, name))?.requires ?? [])
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
export function listOtherTools(scope: Scope, check: Check, command?: string[]): string[] {
    const withoutCoverage =
        hasCoverageArguments(check.command, check.coverage_arguments) &&
        isCoverageOff(scope) &&
        !hasCoverageArguments(command, check.coverage_arguments);
    const otherTools = withoutCoverage ? [] : (check.other_tools ?? []);
    const tools = new Set([
        check.tool,
        ...[check.command, check.fix].flatMap((commandArguments) =>
            commandArguments === undefined ? [] : [commandArguments[0]],
        ),
        ...otherTools,
    ]);
    // ESLint loads the packages of every configuration that adds a block to its tool file.
    const plugins = tools.has(ESLINT_TOOL)
        ? scope.configurations.flatMap((configuration) => configuration.eslint.required_tools)
        : [];
    const syntax =
        check.tool === STYLELINT_TOOL
            ? scope.settings.configurations
                  .flatMap((name) => STYLELINT_COMPONENTS[name] ?? [])
                  .map((dialect) => dialect.customSyntax)
            : [];
    return [...new Set([...otherTools, ...plugins, ...syntax])].filter((name) => {
        const pin = getTool(scope.configurations, name);
        return isToolConditionMet(scope, pin.when);
    });
}

/**
 * Read the executable, fixer, and extra tools that a check uses.
 *
 * @param check the plan with resolved conditions, scopes, and exclusions.
 *
 * @returns the tools to install.
 */
export function listNeededTools(check: PlannedCheck): string[] {
    const names = new Set(
        [check.tool?.name, ...listOtherTools(check.scope, check.check), check.check.fix?.[0]].filter(
            (name) => name !== undefined,
        ),
    );
    addPeerPackages(names, check.scope.configurations);
    return [...names];
}

/**
 * List the configured checks of one scope: its own checks and the checks that run once for the repository.
 *
 * @param session the repository and its configured checks.
 * @param scope the scope whose checks to list.
 *
 * @returns the checks whose tools the scope needs.
 */
export function listScopeChecks(session: Session, scope: Scope): PlannedCheck[] {
    return session.configuredChecks.filter(
        (planned) => planned.scope.folder.path === scope.folder.path || planned.check.runs === 'once',
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
export function selectNeededConfigurations(session: Session, checks: PlannedCheck[]): Configuration[] {
    const licenses = checks
        .filter((entry) => entry.configuration?.name === LICENSES_CONFIGURATION)
        .flatMap((check) =>
            listLicenseProjects(check.files, session.scopes, session.settingsFile.settings, check.check),
        )
        .filter((project) => project.skip === undefined)
        .map((project) =>
            basename(project.dependencyFile) === PACKAGE_JSON ? LICENSE_CHECKER_COMMAND[0] : PIP_LICENSES_COMMAND[0],
        );
    const needed = new Set([...checks.flatMap((check) => listNeededTools(check)), ...licenses]);
    if (needed.has(PRETTIER_TOOL))
        for (const { name } of listPrettierPlugins(
            session.scopes.flatMap(({ configurations }) => configurations),
        ).keys())
            needed.add(name);
    const configurations = listSelectedConfigurations(session.scopes);
    const selectedTools = new Set(
        configurations.flatMap((configuration) => configuration.tools.map(({ name }) => name)),
    );
    addPeerPackages(needed, [...session.configurations.values()]);
    const extras = [...needed].flatMap((name) =>
        selectedTools.has(name)
            ? []
            : [...session.configurations.values()]
                  .filter((configuration) => configuration.tools.some((tool) => tool.name === name))
                  .slice(0, 1),
    );
    const owners = new Set([...configurations, ...extras]);
    return [...owners].map((configuration) => ({
        ...configuration,
        tools: configuration.tools
            .filter(({ when: conditions }) => session.scopes.some((scope) => isToolConditionMet(scope, conditions)))
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
    scopes: Scope[],
    settings: Settings,
    check: Check,
): LicenseProject[] {
    const entries = scopes.map((scope) => scope.folder);
    return scopes.flatMap((scope) =>
        files
            .filter(
                (file) =>
                    !file.path.startsWith(`${DOT_GSPOT}/`) &&
                    findScopeFolder(file.path, entries).path === scope.folder.path,
            )
            .flatMap((file) => {
                if (
                    !scope.configurations.some(
                        (configuration) =>
                            configuration.name === LICENSES_CONFIGURATION &&
                            listCoveredFiles(check.files ?? configuration.files, [file], {
                                configurations: scope.configurations,
                                scopePath: scope.folder.path,
                                settings: scope.settings,
                            }).length > 0,
                    )
                )
                    return [];
                const options = getTable(scope.settings, 'licenses');
                const licenseSettings = { allowed: options.allowed, allowed_package: options.allowed_package };
                return licenseSettings.allowed.length === 0 && licenseSettings.allowed_package.length === 0
                    ? []
                    : [
                          {
                              dependencyFile: file.path,
                              scope,
                              settings: licenseSettings,
                              skip: findSettingsSkip(settings, scope, check),
                          },
                      ];
            }),
    );
}

/**
 * Resolve the formatter plugins once, and keep their declarations and npm entries.
 *
 * @param configurations the configurations in use.
 *
 * @returns the plugins and their module paths.
 */
export function listPrettierPlugins(configurations: Iterable<Configuration>): Map<Tool, PrettierPlugin> {
    return new Map(
        [...configurations].flatMap(({ tools }) =>
            tools.flatMap((tool): [Tool, PrettierPlugin][] => {
                const name = tool.installers['npm']?.name;
                return tool.prettier === undefined || name === undefined
                    ? []
                    : [[tool, { name, entry: tool.prettier.entry, overrides: tool.prettier.overrides }]];
            }),
        ),
    );
}
