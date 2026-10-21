import { AGENTS_FILE } from '#cli/config/rules.ts';
import { buildPathKey } from '#cli/system/paths.ts';
import type { RuleFile } from '#cli/types/rules.ts';
import type { Session } from '#cli/types/planning.ts';
import { stripBlock } from '#cli/system/managed-blocks.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import { buildBunScannerEdits } from '#cli/generation/bun.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { assertWritablePath } from '#cli/system/files/names.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { listRequiredTools } from '#cli/planning/needed-tools.ts';
import { SWIFT_CONFIGURATION } from '#cli/config/configurations.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';
import { buildPointerFieldEdits } from '#cli/generation/pointers.ts';
import { YARN_INSTALL_SETTINGS_FILE } from '#cli/config/tools/npm.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { getTable, findRootSelection } from '#cli/settings/scope-view.ts';
import { usesGitLfs, listHookNames, buildHookFiles } from '#cli/generation/hooks.ts';
import { GITIGNORE_FILE, GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { hasTopHeading, selectRuleFiles, buildAgentsBlock } from '#cli/generation/rules.ts';
import { listSelectedManifests, isConfigurationSelected } from '#cli/configurations/select.ts';
import { buildNpmProject, buildMiseProject, buildPythonProject } from '#cli/generation/projects.ts';
import { buildGithubWorkflow, buildGitlabWorkflow, listProjectInstallLines } from '#cli/generation/ci.ts';
import { DOT_GSPOT, STATE_PATH, VERSION_PIN_FILE, INSTALLED_TOOL_FOLDERS } from '#cli/config/system/locations.ts';
import { isYarnBerry, assertPackageManager, readPackageManagerVersion } from '#cli/repository/package-manager.ts';

import {
    LF_ATTRIBUTES,
    AUTO_LF_ATTRIBUTES,
    GIT_ATTRIBUTES_BLOCK,
    ATTRIBUTE_GLOB_CHARACTERS,
    ATTRIBUTE_QUOTED_CHARACTERS,
} from '#cli/config/generation/files.ts';

// CI includes the manual checks and adds macOS when a scope selects Swift.
function buildWorkflow(session: Session, generated: GenerationResult): void {
    const {
        settingsFile: { settings },
        scopes,
    } = session;
    if (settings.ci?.enabled !== true) return;
    const manual = session.configuredChecks.filter((planned) => planned.check.stage === 'manual');
    const required = new Set(manual.flatMap((element) => listRequiredTools(element)));
    generated.files.push(
        (settings.ci.provider === 'github' ? buildGithubWorkflow : buildGitlabWorkflow)({
            version: packageManifest.version,
            packageManager:
                session.packageManager === undefined
                    ? undefined
                    : readPackageManagerVersion(
                          session.installedRoot,
                          assertPackageManager(session.packageManager),
                          session.timeoutSeconds,
                          session.reads,
                      ),
            setupCommand: settings.ci.setup_command,
            projectInstall: settings.ci.setup_command === undefined ? listProjectInstallLines(session) : [],
            operatingSystems: settings.ci.operating_systems,
            hasSwift: isConfigurationSelected(scopes, SWIFT_CONFIGURATION),
            manualChecks: manual,
            manualTools: listDistinctTools(session.neededToolManifests).filter((tool) => required.has(tool.name)),
        }),
    );
}

// A path as a Git attributes pattern that matches only that file: anchored, with glob characters escaped, and quoted
// when it holds a space or a quote.
function formatAttributePattern(path: string): string {
    const escaped = path.replaceAll(ATTRIBUTE_GLOB_CHARACTERS, (character) => `\\${character}`);
    const pattern = `/${escaped}`;
    if (!ATTRIBUTE_QUOTED_CHARACTERS.test(pattern)) return pattern;
    const quoted = pattern.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
    return `"${quoted}"`;
}

// Each whole file gspot writes outside its folder keeps LF too, so a CRLF checkout does not read as an edit.
function buildAttributesBlock(outsidePaths: string[], authored: string): string {
    const inheritsLineEndings = parseAttributePatterns(authored, '.').some(
        ({ pattern, attributes }) =>
            pattern === '**/*' && AUTO_LF_ATTRIBUTES.every((attribute) => attributes.includes(attribute)),
    );
    const block = inheritsLineEndings
        ? GIT_ATTRIBUTES_BLOCK.split('\n')
              .filter((line) => !line.endsWith(` ${LF_ATTRIBUTES}`))
              .join('\n')
        : GIT_ATTRIBUTES_BLOCK;
    const suffix = inheritsLineEndings ? '' : ` ${LF_ATTRIBUTES}`;
    const lines = outsidePaths
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) => `${formatAttributePattern(path)} linguist-generated${suffix}`);
    return [block, ...lines].join('\n');
}

/**
 * Build the managed .gitignore block for tool projects and generated files.
 *
 * @returns the paths that Git must leave untracked.
 */
function buildGitignoreBlock(): string {
    const toolProjectPaths = [...Object.values(INSTALLED_TOOL_FOLDERS), STATE_PATH].map((path) => `${path}/`);
    return [...toolProjectPaths, `${DOT_GSPOT}/${YARN_INSTALL_SETTINGS_FILE}`].join('\n');
}

function addManagedBlocks(session: Session, rules: RuleFile[], generated: GenerationResult): void {
    const {
        repository,
        settingsFile: { settings },
        reads,
    } = session;
    const outsidePaths = generated.files.map(({ path }) => path).filter((path) => !isInGspotFolder(path));
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
        fileSettings: generated.fileSettings.map(({ path, changes }) => ({
            path,
            keys: changes.map((change) => change.path.join('.')),
        })),
        startCommand: session.startRunner.command,
        files: rules,
        hasChecks: listSelectedManifests(session.scopes).some((manifest) => manifest.checks.length > 0),
    });
    generated.blocks.push({ path: AGENTS_FILE, block, style: 'markdown' });
}

function assertDistinctPaths(generated: GenerationResult): void {
    const paths = new Map<string, string>();
    const files = [...generated.files, ...generated.blocks, ...generated.fileSettings];
    for (const file of files) {
        assertWritablePath(file.path);
        const key = buildPathKey(file.path);
        const previous = paths.get(key);
        if (previous !== undefined) throw new Error(`Generated destinations collide: ${previous} and ${file.path}`);
        paths.set(key, file.path);
    }
}

/**
 * Generate every file in memory, and write nothing.
 *
 * @param session the repository to generate for.
 *
 * @returns everything that apply writes.
 */
function generate(session: Session): GenerationResult {
    const {
        settingsFile: { settings },
        repository,
        scopes,
    } = session;
    const { installedRoot, timeoutSeconds, reads } = session;
    const { root } = repository;
    const packageManager = session.packageManager?.name;
    const manifests = session.neededToolManifests;
    const generated: GenerationResult = {
        files: [{ path: VERSION_PIN_FILE, content: packageManifest.version + '\n' }],
        blocks: [],
        fileSettings: [],
    };
    const toolFiles = getToolFiles(session);
    generated.files.push(...toolFiles.files);
    generated.fileSettings.push(
        ...buildBunScannerEdits(session),
        ...buildPointerFieldEdits(session, generated.files, toolFiles.targets),
    );
    generated.files.push(
        ...buildHookFiles(settings, session.startRunner, {
            names: listHookNames(session.configuredChecks),
            usesLfs: usesGitLfs(session.repository.attributes),
        }),
        // Only Yarn needs the version, which an undeclared package manager reads from the program.
        ...(packageManager === undefined
            ? []
            : buildNpmProject({
                  root,
                  scopes,
                  manifests,
                  isYarnBerry:
                      packageManager === 'yarn' &&
                      isYarnBerry(
                          readPackageManagerVersion(
                              installedRoot,
                              assertPackageManager(session.packageManager),
                              timeoutSeconds,
                              reads,
                          ),
                      ),
              })),
        ...buildPythonProject(manifests, getTable(findRootSelection(scopes).view, 'dependencies').min_release_age_days),
        buildMiseProject(manifests),
    );
    buildWorkflow(session, generated);
    const rules = selectRuleFiles(session);
    generated.files.push(...rules.map(({ target: path, content }) => ({ path, content })));
    addManagedBlocks(session, rules, generated);
    generated.files = generated.files.toSorted((left, right) => left.path.localeCompare(right.path));
    assertDistinctPaths(generated);
    return generated;
}

export { generate };
