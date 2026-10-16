import { AGENTS_FILE } from '#cli/config/rules.ts';
import { buildPathKey } from '#cli/system/paths.ts';
import type { RuleFile } from '#cli/types/rules.ts';
import type { Session } from '#cli/types/planning.ts';
import { buildHookFiles } from '#cli/generation/hooks.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { buildBunfigEdits } from '#cli/generation/bunfig.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { findBlockSpan } from '#cli/system/managed-blocks.ts';
import { assertWritablePath } from '#cli/system/files/names.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { requiredToolNames } from '#cli/planning/needed-tools.ts';
import { SWIFT_CONFIGURATION } from '#cli/config/generation/ci.ts';
import { buildPointerFieldEdits } from '#cli/generation/pointers.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { buildToolFiles } from '#cli/generation/tool-files/generate.ts';
import { selectRuleFiles, buildAgentsBlock } from '#cli/generation/rules.ts';
import { buildGithubWorkflow, buildGitlabWorkflow } from '#cli/generation/ci.ts';
import { NPMRC_FILE, YARN_INSTALL_SETTINGS_FILE } from '#cli/config/tools/npm.ts';
import { GITIGNORE_FILE, GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { listSelectedManifests, isConfigurationSelected } from '#cli/configurations/select.ts';
import { buildNpmProject, buildMiseProject, buildPythonProject } from '#cli/generation/projects.ts';
import { DOT_GSPOT, STATE_DIRECTORY, INSTALLED_TOOL_FOLDERS } from '#cli/config/system/locations.ts';

import {
    LF_ATTRIBUTES,
    AUTO_LF_ATTRIBUTES,
    GIT_ATTRIBUTES_BLOCK,
    ATTRIBUTE_GLOB_CHARACTERS,
    ATTRIBUTE_QUOTED_CHARACTERS,
} from '#cli/config/generation/files.ts';

// CI includes the selected manual checks and adds macOS when a scope selects Swift.
function buildWorkflow(session: Session, generated: GenerationResult): void {
    const {
        settingsFile: { settings },
        scopes,
        version,
    } = session;
    if (settings.ci?.enabled !== true) return;
    const manual = session.configuredChecks.filter((planned) => planned.check.stage === 'manual');
    const required = new Set(manual.flatMap((element) => requiredToolNames(element)));
    generated.files.push(
        (settings.ci.provider === 'github' ? buildGithubWorkflow : buildGitlabWorkflow)({
            version,
            npmClient: session.getPackageManager(),
            setupCommand: settings.ci.setup_command,
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
function buildAttributesBlock(files: GenerationResult['files'], authored: string): string {
    const inheritsLineEndings = parseAttributePatterns(authored, '.').some(
        ({ pattern, attributes }) =>
            pattern === '**/*' && AUTO_LF_ATTRIBUTES.every((attribute) => attributes.includes(attribute)),
    );
    const block = inheritsLineEndings
        ? GIT_ATTRIBUTES_BLOCK.split('\n')
              .filter((line) => !line.endsWith(` ${LF_ATTRIBUTES}`))
              .join('\n')
        : GIT_ATTRIBUTES_BLOCK;
    const outside = files.map(({ path }) => path).filter((path) => !isInGspotFolder(path));
    const lineEndings = inheritsLineEndings ? '' : ` ${LF_ATTRIBUTES}`;
    const lines = outside
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) => `${formatAttributePattern(path)} linguist-generated${lineEndings}`);
    return [block, ...lines].join('\n');
}

function addManagedBlocks(
    session: Session,
    manifests: Manifest[],
    rules: RuleFile[],
    generated: GenerationResult,
): void {
    const {
        repository,
        settingsFile: { settings },
        reads,
    } = session;
    const text = readCachedText(reads, GITATTRIBUTES_FILE) ?? '';
    const span = findBlockSpan(text, { path: GITATTRIBUTES_FILE, style: 'hash' });
    const authored = span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
    if (repository.hasGit) {
        generated.blocks.push(
            { path: GITIGNORE_FILE, block: buildGitignoreBlock(), style: 'hash' },
            {
                path: GITATTRIBUTES_FILE,
                block: buildAttributesBlock(generated.files, authored),
                style: 'hash',
            },
        );
    }
    if (!settings.rules.enabled) return;
    const block = buildAgentsBlock({
        generatedPaths: [...generated.files, ...generated.fileEdits]
            .map(({ path }) => path)
            .filter((path) => !isInGspotFolder(path)),
        startCommand: session.startRunner.command,
        files: rules,
        level: settings.level,
        hasChecks: manifests.some((manifest) => manifest.checks.length > 0),
    });
    for (const path of new Set([AGENTS_FILE, ...settings.rules.instruction_files]))
        generated.blocks.push({ path, block, style: 'markdown' });
}

function mergeFileEdits(generated: GenerationResult): void {
    const assembled = new Map<string, GenerationResult['fileEdits'][number]>();
    for (const file of generated.fileEdits) {
        const previous = assembled.get(file.path);
        if (previous === undefined) assembled.set(file.path, { ...file, changes: [...file.changes] });
        else {
            previous.changes.push(...file.changes);
        }
    }
    generated.fileEdits = [...assembled.values()];
}

function assertDistinctPaths(generated: GenerationResult): void {
    const paths = new Map<string, string>();
    const files = [...generated.files, ...generated.blocks, ...generated.fileEdits];
    for (const file of files) {
        assertWritablePath(file.path);
        const key = buildPathKey(file.path);
        const previous = paths.get(key);
        if (previous !== undefined) throw new Error(`Generated destinations collide: ${previous} and ${file.path}`);
        paths.set(key, file.path);
    }
}

/**
 * The managed .gitignore block for tool projects and generated files.
 * @returns the paths that Git must leave untracked.
 */
export function buildGitignoreBlock(): string {
    const toolProjectPaths = [...Object.values(INSTALLED_TOOL_FOLDERS), STATE_DIRECTORY].map((path) => `${path}/`);
    return [...toolProjectPaths, `${DOT_GSPOT}/${NPMRC_FILE}`, `${DOT_GSPOT}/${YARN_INSTALL_SETTINGS_FILE}`].join('\n');
}

/**
 * Emits every generated file in memory and writes nothing.
 *
 * @param session the repository inventory, effective settings, and selected tools.
 *
 * @returns the files, managed blocks, authored config-file edits, and notes.
 */
export function generate(session: Session): GenerationResult {
    const {
        settingsFile: { settings },
        repository,
        scopes,
    } = session;
    const { root, files } = repository;
    const npmClient = session.getPackageManager();
    const manifests = session.neededToolManifests;
    const tools = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const checks = session.configuredChecks;
    const repositoryConsumers = { tools, checks: new Set(checks.map((check) => check.check.name)) };
    const generated: GenerationResult = { notes: [], files: [], blocks: [], fileEdits: [] };
    const seen = new Set<string>();
    for (const selection of scopes) {
        const scopeChecks = checks.filter(
            (check) => check.scope.scope.path === selection.scope.path || check.check.runs === 'once',
        );
        const scopeConsumers = {
            tools: new Set(scopeChecks.flatMap((check) => requiredToolNames(check))),
            checks: new Set(scopeChecks.map((check) => check.check.name)),
        };
        buildToolFiles({ session, files, scopes, manifests, selection }, generated, seen, {
            repository: repositoryConsumers,
            scope: scopeConsumers,
        });
    }
    generated.fileEdits.push(...buildBunfigEdits(root, scopes), ...buildPointerFieldEdits(session, generated.files));
    generated.files.push(
        ...buildHookFiles(root, settings, session.startRunner),
        ...buildNpmProject({ root, scopes, manifests, installer: npmClient }),
        ...buildPythonProject(manifests),
        buildMiseProject(manifests, session.reads),
    );
    buildWorkflow(session, generated);
    const selected = listSelectedManifests(scopes);
    const rules = selectRuleFiles(settings.rules, selected, repository, settings.level, session.packageManifests);
    generated.files.push(
        ...rules.map((file) => ({
            path: file.target,
            content: file.content,
            kind: 'rules' as const,
        })),
    );
    addManagedBlocks(session, selected, rules, generated);
    generated.files.sort((a, b) => a.path.localeCompare(b.path));
    mergeFileEdits(generated);
    assertDistinctPaths(generated);
    return generated;
}
