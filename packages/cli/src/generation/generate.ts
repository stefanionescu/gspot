import { JSON_INDENT } from '#cli/config/text.ts';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { listHookNames } from '#cli/installers/hooks.ts';
import { buildHookFiles } from '#cli/generation/hooks.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { findCachedText } from '#cli/system/files/reads.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import { buildJsonSchema } from '#cli/settings/json-schema.ts';
import type { RuleFile } from '#cli/types/generation/rules.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { getTable, findRootScope } from '#cli/settings/scopes.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files/tracked.ts';
import { SWIFT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { AGENTS_FILE, GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { YARN_INSTALL_SETTINGS_FILE } from '#cli/config/installers/npm/yarn.ts';
import { buildPointerFieldEdits } from '#cli/generation/config-files/pointers.ts';
import { hasTopHeading, selectRuleFiles, buildAgentsBlock } from '#cli/generation/rules.ts';
import { DOT_GSPOT, GSPOT_PATHS, INSTALLED_TOOL_FOLDERS } from '#cli/config/gspot-folder.ts';
import { buildBunScannerEdits } from '#cli/generation/configurations/general/dependencies.ts';
import { isConfigurationSelected, listSelectedConfigurations } from '#cli/configurations/select.ts';
import { buildNpmProject, buildMiseProject, buildPythonProject } from '#cli/installers/projects.ts';
import { selectToolPackageManager, readPackageManagerVersion } from '#cli/repository/npm/package-manager.ts';

import {
    buildGithubWorkflow,
    buildGitlabWorkflow,
    listProjectLockfiles,
    listProjectInstallLines,
} from '#cli/generation/ci.ts';
import {
    LF_ATTRIBUTES,
    AUTO_LF_ATTRIBUTES,
    GIT_ATTRIBUTES_BLOCK,
    ATTRIBUTE_GLOB_CHARACTERS,
    ATTRIBUTE_QUOTED_CHARACTERS,
} from '#cli/config/generation/generate.ts';

function buildWorkflow(session: Session, generated: GenerationResult): void {
    const {
        settingsFile: { settings },
        scopes,
    } = session;
    if (settings.ci?.enabled !== true) return;
    const manual = session.configuredChecks.filter((planned) => planned.check.stage === 'manual');
    generated.files.push(
        (settings.ci.provider === 'github' ? buildGithubWorkflow : buildGitlabWorkflow)({
            version: cliPackage.version,
            packageManager:
                session.packageManager === undefined
                    ? undefined
                    : readPackageManagerVersion(
                          session.installedRoot,
                          session.packageManager,
                          session.timeoutSeconds,
                          session.reads,
                      ),
            setupCommand: settings.ci.setup_command,
            projectInstall: settings.ci.setup_command === undefined ? listProjectInstallLines(session) : [],
            operatingSystems: settings.ci.operating_systems,
            linuxRunner: settings.ci.linux_runner,
            lockfiles: listProjectLockfiles(session),
            hasSwift: isConfigurationSelected(scopes, SWIFT_CONFIGURATION),
            manualChecks: manual,
            tools: listDistinctTools(session.toolConfigurations),
        }),
    );
}

function buildAttributePattern(path: string): string {
    const escaped = path.replaceAll(ATTRIBUTE_GLOB_CHARACTERS, (character) => `\\${character}`);
    const pattern = `/${escaped}`;
    if (!ATTRIBUTE_QUOTED_CHARACTERS.test(pattern)) return pattern;
    const quoted = pattern.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
    return `"${quoted}"`;
}

function buildAttributesBlock(outsidePaths: string[], authored: string): string {
    const hasAutoLineEndings = parseAttributePatterns(authored, '.').some(
        ({ pattern, attributes }) =>
            pattern === '**/*' && AUTO_LF_ATTRIBUTES.every((attribute) => attributes.includes(attribute)),
    );
    const block = hasAutoLineEndings
        ? GIT_ATTRIBUTES_BLOCK.split('\n')
              .filter((line) => !line.endsWith(` ${LF_ATTRIBUTES}`))
              .join('\n')
        : GIT_ATTRIBUTES_BLOCK;
    const suffix = hasAutoLineEndings ? '' : ` ${LF_ATTRIBUTES}`;
    const lines = outsidePaths
        .toSorted((left, right) => compareText(left, right))
        .map((path) => `${buildAttributePattern(path)} linguist-generated${suffix}`);
    return [block, ...lines].join('\n');
}

function buildGitignoreBlock(): string {
    const toolProjectPaths = [...Object.values(INSTALLED_TOOL_FOLDERS), GSPOT_PATHS.state].map((path) => `${path}/`);
    return [...toolProjectPaths, `${DOT_GSPOT}/${YARN_INSTALL_SETTINGS_FILE}`].join('\n');
}

function addManagedBlocks(session: Session, rules: RuleFile[], generated: GenerationResult): void {
    const {
        settingsFile: { settings },
        repository,
        reads,
    } = session;
    const outsidePaths = generated.files.map(({ path }) => path).filter((path) => !path.startsWith(`${DOT_GSPOT}/`));
    const text = findCachedText(reads, GITATTRIBUTES_FILE) ?? '';
    const authored = stripBlock(text, { path: GITATTRIBUTES_FILE, style: 'hash' });
    if (repository.hasGit) {
        generated.blocks.push(
            { path: GITIGNORE_FILE, block: buildGitignoreBlock(), style: 'hash' },
            {
                path: GITATTRIBUTES_FILE,
                block: buildAttributesBlock(outsidePaths, authored),
                style: 'hash',
            },
        );
    }
    if (!settings.rules.enabled) return;
    const agents = findCachedText(reads, AGENTS_FILE) ?? '';
    const agentsText = stripBlock(agents, { path: AGENTS_FILE, style: 'markdown' });
    const block = buildAgentsBlock({
        hasOwnTitle: hasTopHeading(agentsText),
        generatedPaths: outsidePaths,
        managedKeys: generated.managedKeys.map(({ path, keys }) => ({
            path,
            keys: keys.map((change) => change.key.join('.')),
        })),
        startCommand: session.startRunner.command,
        files: rules,
        hasChecks: listSelectedConfigurations(session.scopes).some((configuration) => configuration.checks.length > 0),
    });
    generated.blocks.push({ path: AGENTS_FILE, block, style: 'markdown' });
}

/**
Generate every file in memory, and write nothing.

@param session the repository to generate for.

@returns everything that apply writes.
*/
export function generate(session: Session): GenerationResult {
    const {
        settingsFile: { settings },
        scopes,
    } = session;
    const { installedRoot, timeoutSeconds, reads, packageManager, toolConfigurations } = session;
    const generated: GenerationResult = {
        files: [
            { path: GSPOT_PATHS.versionPin, content: cliPackage.version + '\n' },
            { path: GSPOT_PATHS.settingsSchema, content: `${JSON.stringify(buildJsonSchema(), null, JSON_INDENT)}\n` },
        ],
        blocks: [],
        managedKeys: [],
    };
    const configFiles = getConfigFiles(session);
    const [failure] = configFiles.failures.values().flatMap((failures) => failures.values());
    if (failure !== undefined) throw failure;
    generated.files.push(...configFiles.files);
    generated.managedKeys.push(
        ...buildBunScannerEdits(session),
        ...buildPointerFieldEdits(session, generated.files, configFiles),
    );
    const minimumAge = getTable(findRootScope(scopes).settings, 'dependencies').min_release_age_days;
    generated.files.push(
        ...(settings.hooks?.enabled === true
            ? buildHookFiles(session.startRunner, listHookNames(session.configuredChecks))
            : []),
        ...(packageManager === undefined
            ? []
            : buildNpmProject(
                  toolConfigurations,
                  selectToolPackageManager(installedRoot, packageManager, timeoutSeconds, reads),
              )),
        ...buildPythonProject(toolConfigurations, minimumAge),
        buildMiseProject(toolConfigurations),
    );
    buildWorkflow(session, generated);
    const rules = selectRuleFiles(session);
    generated.files.push(...rules.map(({ target: path, content }) => ({ path, content })));
    addManagedBlocks(session, rules, generated);
    generated.files = generated.files.toSorted((left, right) => compareText(left.path, right.path));
    return generated;
}
