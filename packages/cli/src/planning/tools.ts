import { basename } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { selectCheckFiles } from '#cli/planning/files.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { getTool, findToolProjectPackage } from '#cli/manifests/tools.ts';
import { isSettingEmpty, findSettingsSkip } from '#cli/planning/skips.ts';
import type { PrettierPlugin } from '#cli/types/generation/formatting.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { PRETTIER_TOOL, STYLELINT_TOOL } from '#cli/config/planning/tools.ts';
import { isCoverageOff, hasCoverageArguments } from '#cli/planning/checks.ts';
import { selectScopePath, listNestedScopes } from '#cli/repository/scopes.ts';
import type { LicenseProject, ConfiguredCheck } from '#cli/types/planning.ts';
import { PIP_LICENSES_COMMAND, LICENSE_CHECKER_COMMAND } from '#cli/config/licenses.ts';
import { STYLELINT_COMPONENTS } from '#cli/config/generation/configurations/language/css.ts';
import { ESLINT_MANIFEST_TOOL, LICENSES_CONFIGURATION } from '#cli/config/manifests/names.ts';

function isToolConditionMet(scope: Scope, conditions: Tool['when']): boolean {
    return (
        conditions === undefined ||
        conditions.some((condition) => {
            if (condition.level !== undefined && condition.level !== scope.settings.valuesByKey['level']) return false;
            if (condition.setting === undefined) return true;
            return !isSettingEmpty(scope.settings.valuesByKey[condition.setting]);
        })
    );
}

function addPeerPackages(names: Set<string>, configurations: readonly Configuration[]): void {
    for (const name of names)
        for (const required of findToolProjectPackage(getTool(configurations, name))?.requires ?? [])
            names.add(required);
}

/**
List the extra tools that the command and the configuration of a check use.

@param scope where the check runs.
@param check the check to read.
@param command the arguments that run, if known.
@returns each extra tool once.
*/
export function listOtherTools(scope: Scope, check: Check, command?: string[]): string[] {
    const withoutCoverage =
        hasCoverageArguments(check.command, check.coverage_arguments) &&
        isCoverageOff(scope) &&
        !hasCoverageArguments(command, check.coverage_arguments);
    const otherTools = withoutCoverage ? [] : (check.other_tools ?? []);
    const tools = [
        check.tool,
        ...[check.command, check.fix].flatMap((commandArguments) =>
            commandArguments === undefined ? [] : [commandArguments[0]],
        ),
        ...otherTools,
    ];
    const plugins = tools.includes(ESLINT_MANIFEST_TOOL)
        ? scope.configurations.flatMap((configuration) => configuration.eslint.required_tools)
        : [];
    const syntax =
        check.tool === STYLELINT_TOOL
            ? scope.settings.configurations
                  .flatMap((name) =>
                      STYLELINT_COMPONENTS.filter((component) =>
                          component.files.some((pattern) => pattern.endsWith(`.${name}`)),
                      ),
                  )
                  .map((dialect) => dialect.customSyntax)
            : [];
    return [...new Set([...otherTools, ...plugins, ...syntax])].filter((name) => {
        const pin = getTool(scope.configurations, name);
        return isToolConditionMet(scope, pin.when);
    });
}

/**
List the tool that a check runs, its fixer, its extra tools, and the packages they require.

@param planned the plan with resolved conditions, scopes, and exclusions.
*/
export function listCheckTools(planned: ConfiguredCheck): string[] {
    const names = new Set(
        [planned.tool?.name, ...listOtherTools(planned.scope, planned.check), planned.check.fix?.[0]].filter(
            (name) => name !== undefined,
        ),
    );
    addPeerPackages(names, planned.scope.configurations);
    return [...names];
}

/**
Select the tools that checks, fixers, and their config files use. The tools cover every supported system, so committed
output does not depend on this machine.

@param session the repository and its settings.
@param checks the plans for every supported system.
@returns the configurations with only the tools they need.
*/
export function selectToolConfigurations(session: Session, checks: ConfiguredCheck[]): Configuration[] {
    const licenses = checks
        .filter((each) => each.configuration?.name === LICENSES_CONFIGURATION)
        .flatMap((configured) => {
            const selection = selectCheckFiles(
                {
                    session,
                    scope: configured.scope,
                    options: { stage: 'any' },
                    host: { platform: getOperatingSystem(), arch: process.arch },
                    narrowedPaths: undefined,
                    children: listNestedScopes(
                        session.scopes.map((scope) => scope.path),
                        configured.scope.path,
                    ),
                },
                configured,
            );
            return listLicenseProjects(selection.files, session.scopes, session.settings, configured.check);
        })
        .filter((project) => project.skip === undefined)
        .map((project) =>
            basename(project.dependencyFile) === PACKAGE_JSON ? LICENSE_CHECKER_COMMAND[0] : PIP_LICENSES_COMMAND[0],
        );
    const toolNames = new Set([...checks.flatMap((check) => listCheckTools(check)), ...licenses]);
    if (toolNames.has(PRETTIER_TOOL))
        for (const { name } of listPrettierPlugins(
            session.scopes.flatMap(({ configurations }) => configurations),
        ).keys())
            toolNames.add(name);
    const configurations = listSelectedConfigurations(session.scopes);
    const selectedTools = new Set(
        configurations.flatMap((configuration) => configuration.tools.map(({ name }) => name)),
    );
    addPeerPackages(toolNames, [...session.configurationsByName.values()]);
    const unselected = [...toolNames].flatMap((name) =>
        selectedTools.has(name)
            ? []
            : ([...session.configurationsByName.values()].find((configuration) =>
                  configuration.tools.some((tool) => tool.name === name),
              ) ?? []),
    );
    const owners = new Set([...configurations, ...unselected]);
    return [...owners].map((configuration) => ({
        ...configuration,
        tools: configuration.tools
            .filter(({ when: conditions }) => session.scopes.some((scope) => isToolConditionMet(scope, conditions)))
            .filter((tool) => toolNames.has(tool.name)),
    }));
}

/**
List the dependency files that the licenses check reads, each with its scope, its allowed licenses, and the skip that
the settings cause.

@param files the inventory that the check reads.
@param scopes every scope.
@param settings the validated gspot.toml.
@param check the licenses check.
@returns one project for each dependency file whose scope sets allowed licenses.
*/
export function listLicenseProjects(
    files: TrackedFile[],
    scopes: Scope[],
    settings: Settings,
    check: Check,
): LicenseProject[] {
    return scopes.flatMap((scope) =>
        files
            .filter(
                (file) =>
                    !file.path.startsWith(`${GSPOT_FOLDER}/`) && selectScopePath(file.path, scopes) === scope.path,
            )
            .flatMap((file) => {
                if (
                    !scope.configurations.some(
                        (configuration) =>
                            configuration.name === LICENSES_CONFIGURATION &&
                            listCoveredFiles(check.files ?? configuration.files, [file], {
                                configurations: scope.configurations,
                                scopePath: scope.path,
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
Map each tool that declares a Prettier plugin to its npm package name, module, and overrides.

@param configurations the configurations in use.
*/
export function listPrettierPlugins(configurations: Iterable<Configuration>): Map<Tool, PrettierPlugin> {
    return new Map(
        [...configurations].flatMap(({ tools }) =>
            tools.flatMap((tool): [Tool, PrettierPlugin][] => {
                const name = tool.installers['npm']?.name;
                return tool.prettier === undefined || name === undefined
                    ? []
                    : [[tool, { name, module: tool.prettier.module, overrides: tool.prettier.overrides }]];
            }),
        ),
    );
}
