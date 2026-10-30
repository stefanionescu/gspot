import { basename } from 'node:path/posix';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { listHookNames } from '#cli/installers/hooks.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildHookFiles } from '#cli/generation/hooks.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { findCachedText } from '#cli/system/files/reads.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import { FROZEN_INSTALLS } from '#cli/config/generation/ci.ts';
import type { RuleFile } from '#cli/types/generation/rules.ts';
import type { Generation } from '#cli/types/generation/files.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import { SWIFT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { buildConfigFiles } from '#cli/generation/config-files/generate.ts';
import { AGENTS_FILE, GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { listWrittenPaths } from '#cli/generation/config-files/ignore-files.ts';
import { buildPointerFieldEdits } from '#cli/generation/config-files/pointers.ts';
import { readPackageManagerVersion } from '#cli/repository/npm/package-manager.ts';
import type { FrozenLockfile, CiPackageManager } from '#cli/types/generation/ci.ts';
import { LFS_FILTER, FILTER_ATTRIBUTE } from '#cli/config/repository/files/classify.ts';
import { hasTopHeading, selectRuleFiles, buildAgentsBlock } from '#cli/generation/rules.ts';
import { buildBunScannerEdits } from '#cli/generation/configurations/general/dependencies.ts';
import { buildNpmProject, buildMiseProject, buildPythonProject } from '#cli/generation/tool-projects.ts';

import {
    buildGithubWorkflow,
    buildGitlabWorkflow,
    listProjectLockfiles,
    listProjectInstallLines,
} from '#cli/generation/ci.ts';
import {
    LF_ATTRIBUTES,
    AUTO_LF_ATTRIBUTES,
    TOOL_FOLDER_IGNORES,
    GIT_ATTRIBUTES_BLOCK,
    ATTRIBUTE_GLOB_CHARACTERS,
    ATTRIBUTE_QUOTED_CHARACTERS,
} from '#cli/config/generation/generate.ts';

function listWorkflowPackageManagers(session: Session, generated: Generation, lockfiles: string[]): CiPackageManager[] {
    const packageManagers = new Set<CiPackageManager>(
        lockfiles.map((path) => FROZEN_INSTALLS[basename(path) as FrozenLockfile][0]),
    );
    if (generated.files.some(({ path }) => path === GSPOT_PATHS.npmProject) && session.packageManager !== undefined)
        packageManagers.add(session.packageManager.name === 'yarn' ? 'npm' : session.packageManager.name);
    if (generated.files.some(({ path }) => path === GSPOT_PATHS.pythonProject)) packageManagers.add('uv');
    return [...packageManagers].toSorted(compareText);
}

function addWorkflow(session: Session, generated: Generation): void {
    const { settings, scopes } = session;
    if (settings.ci?.enabled !== true) return;
    const lockfiles = listProjectLockfiles(session);
    const packageManagers = listWorkflowPackageManagers(session, generated, lockfiles);
    generated.files.push(
        (settings.ci.provider === 'github' ? buildGithubWorkflow : buildGitlabWorkflow)({
            version: cliPackage.version,
            packageManager:
                session.packageManager === undefined
                    ? undefined
                    : readPackageManagerVersion(
                          session.toolsRoot,
                          session.packageManager,
                          session.timeoutSeconds,
                          session.reads,
                      ),
            setupCommand: settings.ci.setup_command,
            projectInstall: settings.ci.setup_command === undefined ? listProjectInstallLines(session) : [],
            operatingSystems: settings.ci.operating_systems,
            linuxRunner: settings.ci.linux_runner,
            lockfiles,
            hasSwift: isConfigurationSelected(scopes, SWIFT_CONFIGURATION),
            packageManagers,
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

function addManagedBlocks(session: Session, rules: RuleFile[], generated: Generation): void {
    const { settings, reads } = session;
    const outsidePaths = listWrittenPaths(session).map((path) => path.slice(1));
    const text = findCachedText(reads, GITATTRIBUTES_FILE) ?? '';
    const authored = stripBlock(text, { path: GITATTRIBUTES_FILE });
    generated.blocks.push({ path: GITATTRIBUTES_FILE, body: buildAttributesBlock(outsidePaths, authored) });
    if (!settings.rules.enabled) return;
    const agents = findCachedText(reads, AGENTS_FILE) ?? '';
    const agentsText = stripBlock(agents, { path: AGENTS_FILE });
    const block = buildAgentsBlock({
        hasOwnTitle: hasTopHeading(agentsText),
        managedKeys: generated.managedKeys
            .map(({ path, keys }) => ({
                path,
                keys: keys.filter((change) => change.value !== undefined).map((change) => change.key.join('.')),
            }))
            .filter(({ keys }) => keys.length > 0),
        startCommand: session.startRunner.command,
        files: rules,
    });
    generated.blocks.push({ path: AGENTS_FILE, body: block });
}

/**
Generate every file in memory, and write nothing.

@param session the repository to generate for.

@returns everything that apply writes.
*/
export function generateFiles(session: Session): Generation {
    const { settings } = session;
    const { packageManager, toolConfigurations } = session;
    const generated: Generation = {
        files: [{ path: GSPOT_PATHS.gitignore, content: TOOL_FOLDER_IGNORES.join('\n') + '\n' }],
        blocks: [],
        managedKeys: [],
    };
    const configFiles = buildConfigFiles(session);
    const [failure] = configFiles.failures.values().flatMap((failures) => failures.values());
    if (failure !== undefined) throw failure;
    generated.files.push(...configFiles.files);
    generated.managedKeys.push(
        ...buildBunScannerEdits(session),
        ...buildPointerFieldEdits(session, generated.files, configFiles),
    );
    generated.files.push(
        ...(settings.hooks?.enabled === true
            ? buildHookFiles(session.startRunner, listHookNames(session.configuredChecks), {
                  hasLfsFiles: session.repository.attributes
                      .values()
                      .some((attributes) => attributes[FILTER_ATTRIBUTE] === LFS_FILTER),
              })
            : []),
        ...(packageManager === undefined ? [] : buildNpmProject(toolConfigurations)),
        ...buildPythonProject(toolConfigurations),
        buildMiseProject(toolConfigurations),
    );
    addWorkflow(session, generated);
    const rules = selectRuleFiles(session);
    generated.files.push(...rules.map(({ target: path, content }) => ({ path, content })));
    addManagedBlocks(session, rules, generated);
    generated.files = generated.files.toSorted((left, right) => compareText(left.path, right.path));
    return generated;
}
