import { JSON_INDENT } from '#cli/config/text.ts';
import type { Session } from '#cli/types/session.ts';
import { listNeededTools } from '#cli/planning/tools.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { findCachedText } from '#cli/system/files/reads.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import { buildJsonSchema } from '#cli/settings/json-schema.ts';
import { assertWritablePath } from '#cli/system/files/names.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { getTable, findRootScope } from '#cli/settings/scopes.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import type { RuleFile } from '#cli/types/generation/agent-rules.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files/tracked.ts';
import { listHookNames, buildHookFiles } from '#cli/generation/hooks.ts';
import { SWIFT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { AGENTS_FILE, GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { YARN_INSTALL_SETTINGS_FILE } from '#cli/config/install/npm/yarn.ts';
import { buildPointerFieldEdits } from '#cli/generation/config-files/pointers.ts';
import { LFS_FILTER, FILTER_ATTRIBUTE } from '#cli/config/repository/files/classify.ts';
import { DOT_GSPOT, GSPOT_PATHS, INSTALLED_TOOL_FOLDERS } from '#cli/config/gspot-folder.ts';
import { buildBunScannerEdits } from '#cli/generation/configurations/general/dependencies.ts';
import { hasTopHeading, selectRuleFiles, buildAgentsBlock } from '#cli/generation/agent-rules.ts';
import { isConfigurationSelected, listSelectedConfigurations } from '#cli/configurations/select.ts';
import { buildNpmProject, buildMiseProject, buildPythonProject } from '#cli/generation/tool-projects.ts';
import { buildGithubWorkflow, buildGitlabWorkflow, listProjectInstallLines } from '#cli/generation/ci.ts';
import { isYarnBerry, assertPackageManager, readPackageManagerVersion } from '#cli/repository/npm/package-manager.ts';

import {
    LF_ATTRIBUTES,
    AUTO_LF_ATTRIBUTES,
    GIT_ATTRIBUTES_BLOCK,
    ATTRIBUTE_GLOB_CHARACTERS,
    ATTRIBUTE_QUOTED_CHARACTERS,
} from '#cli/config/generation/generate.ts';

// CI includes the manual checks and adds macOS when a scope selects Swift.
function buildWorkflow(session: Session, generated: GenerationResult): void {
    const {
        settingsFile: { settings },
        scopes,
    } = session;
    if (settings.ci?.enabled !== true) return;
    const manual = session.configuredChecks.filter((planned) => planned.check.stage === 'manual');
    const required = new Set(manual.flatMap((planned) => listNeededTools(planned)));
    generated.files.push(
        (settings.ci.provider === 'github' ? buildGithubWorkflow : buildGitlabWorkflow)({
            version: cliPackage.version,
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
            manualTools: listDistinctTools(session.neededToolConfigurations).filter((tool) => required.has(tool.name)),
        }),
    );
}

// A path as a Git attributes pattern that matches only that file: anchored, with glob characters escaped, and quoted
// when it holds a space or a quote.
function buildAttributePattern(path: string): string {
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
        .map((path) => `${buildAttributePattern(path)} linguist-generated${suffix}`);
    return [block, ...lines].join('\n');
}

/**
 * Build the managed .gitignore block for tool projects and generated files.
 *
 * @returns the paths that Git must leave untracked.
 */
function buildGitignoreBlock(): string {
    const toolProjectPaths = [...Object.values(INSTALLED_TOOL_FOLDERS), GSPOT_PATHS.state].map((path) => `${path}/`);
    return [...toolProjectPaths, `${DOT_GSPOT}/${YARN_INSTALL_SETTINGS_FILE}`].join('\n');
}

function addManagedBlocks(session: Session, rules: RuleFile[], generated: GenerationResult): void {
    const {
        repository,
        settingsFile: { settings },
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

function assertDistinctPaths(generated: GenerationResult): void {
    const paths = new Map<string, string>();
    const files = [...generated.files, ...generated.blocks, ...generated.managedKeys];
    for (const file of files) {
        assertWritablePath(file.path);
        const key = file.path.normalize('NFC').toLowerCase();
        const previous = paths.get(key);
        if (previous !== undefined)
            throw new Error(`Two generated files have the same path: ${previous} and ${file.path}.`);
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
export function generate(session: Session): GenerationResult {
    const {
        settingsFile: { settings },
        repository,
        scopes,
    } = session;
    const { installedRoot, timeoutSeconds, reads } = session;
    const { root } = repository;
    const packageManager = session.packageManager?.name;
    const configurations = session.neededToolConfigurations;
    const generated: GenerationResult = {
        files: [
            { path: GSPOT_PATHS.versionPin, content: cliPackage.version + '\n' },
            { path: GSPOT_PATHS.settingsSchema, content: `${JSON.stringify(buildJsonSchema(), null, JSON_INDENT)}\n` },
        ],
        blocks: [],
        managedKeys: [],
    };
    const configFiles = getConfigFiles(session);
    generated.files.push(...configFiles.files);
    generated.managedKeys.push(
        ...buildBunScannerEdits(session),
        ...buildPointerFieldEdits(session, generated.files, configFiles.targets),
    );
    generated.files.push(
        ...buildHookFiles(settings, session.startRunner, {
            names: listHookNames(session.configuredChecks),
            usesLfs: session.repository.attributes.values().some((values) => values[FILTER_ATTRIBUTE] === LFS_FILTER),
        }),
        // Only Yarn needs the package manager version; reading it can start the package manager when package.json
        // declares no version.
        ...(packageManager === undefined
            ? []
            : buildNpmProject({
                  root,
                  scopes,
                  configurations,
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
        ...buildPythonProject(
            configurations,
            getTable(findRootScope(scopes).settings, 'dependencies').min_release_age_days,
        ),
        buildMiseProject(configurations),
    );
    buildWorkflow(session, generated);
    const rules = selectRuleFiles(session);
    generated.files.push(...rules.map(({ target: path, content }) => ({ path, content })));
    addManagedBlocks(session, rules, generated);
    generated.files = generated.files.toSorted((left, right) => left.path.localeCompare(right.path));
    assertDistinctPaths(generated);
    return generated;
}
