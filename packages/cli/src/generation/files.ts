import { pathKey } from '#cli/system/paths.ts';
import { AGENTS_FILE } from '#cli/config/rules.ts';
import { miseFile } from '#cli/generation/mise.ts';
import { npmProject } from '#cli/generation/npm.ts';
import type { RuleFile } from '#cli/types/rules.ts';
import { hookFiles } from '#cli/generation/hooks.ts';
import { attributeRules } from '#cli/parsers/git.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { Session } from '#cli/types/planning.ts';
import { bunfigChanges } from '#cli/generation/bunfig.ts';
import { pythonProject } from '#cli/generation/python.ts';
import { blockSpan } from '#cli/system/managed-blocks.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { emitToolFiles } from '#cli/generation/tool-files.ts';
import { collectPins } from '#cli/configurations/tool-pins.ts';
import { githubFile, gitlabFile } from '#cli/generation/ci.ts';
import { packageRedirects } from '#cli/generation/redirects.ts';
import { assertWritablePath } from '#cli/system/files/names.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import { requiredToolNames } from '#cli/planning/needed-tools.ts';
import { SWIFT_CONFIGURATION } from '#cli/config/generation/ci.ts';
import { managedBlock, selectRuleFiles } from '#cli/generation/rules.ts';
import { NPMRC_FILE, YARN_INSTALL_SETTINGS_FILE } from '#cli/config/tools/npm.ts';
import { GITIGNORE_FILE, GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { everyManifest, isConfigurationSelected } from '#cli/configurations/select.ts';
import { DOT_GSPOT, STATE_DIRECTORY, INSTALLED_TOOL_FOLDERS } from '#cli/config/system/locations.ts';

import {
    LF_ATTRIBUTES,
    AUTO_LF_ATTRIBUTES,
    GIT_ATTRIBUTES_BLOCK,
    ATTRIBUTE_GLOB_CHARACTERS,
    ATTRIBUTE_QUOTED_CHARACTERS,
} from '#cli/config/generation/files.ts';

// CI includes the selected manual checks and adds macOS when a scope selects Swift.
function emitWorkflow(session: Session, generated: Generated): void {
    const {
        settingsFile: { settings },
        scopes,
        version,
    } = session;
    if (settings.ci?.enabled !== true) return;
    const manual = session.configuredChecks.filter((planned) => planned.check.stage === 'manual');
    const required = new Set(manual.flatMap((element) => requiredToolNames(element)));
    generated.files.push(
        (settings.ci.provider === 'github' ? githubFile : gitlabFile)({
            version,
            npmClient: session.npmClient(),
            setupCommand: settings.ci.setup_command,
            operatingSystems: settings.ci.operating_systems,
            hasSwift: isConfigurationSelected(scopes, SWIFT_CONFIGURATION),
            manualChecks: manual,
            manualTools: collectPins(session.neededToolManifests).filter((tool) => required.has(tool.name)),
        }),
    );
}

// A path as a Git attributes pattern that matches only that file: anchored, with glob characters escaped, and quoted
// when it holds a space or a quote.
function attributePattern(path: string): string {
    const escaped = path.replaceAll(ATTRIBUTE_GLOB_CHARACTERS, (character) => `\\${character}`);
    const pattern = `/${escaped}`;
    if (!ATTRIBUTE_QUOTED_CHARACTERS.test(pattern)) return pattern;
    const quoted = pattern.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
    return `"${quoted}"`;
}

// Each whole file gspot writes outside its folder keeps LF too, so a CRLF checkout does not read as an edit.
function attributesBlock(files: Generated['files'], authored: string): string {
    const inheritsLineEndings = attributeRules(authored, '.').some(
        ({ pattern, attributes }) =>
            pattern === '**/*' && AUTO_LF_ATTRIBUTES.every((attribute) => attributes.includes(attribute)),
    );
    const block = inheritsLineEndings
        ? GIT_ATTRIBUTES_BLOCK.split('\n')
              .filter((line) => !line.endsWith(` ${LF_ATTRIBUTES}`))
              .join('\n')
        : GIT_ATTRIBUTES_BLOCK;
    const outside = files.map(({ path }) => path).filter((path) => !path.startsWith(`${DOT_GSPOT}/`));
    const lineEndings = inheritsLineEndings ? '' : ` ${LF_ATTRIBUTES}`;
    const lines = outside
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) => `${attributePattern(path)} linguist-generated${lineEndings}`);
    return [block, ...lines].join('\n');
}

function emitBlocks(session: Session, manifests: Manifest[], rules: RuleFile[], generated: Generated): void {
    const {
        repository,
        settingsFile: { settings },
        reads,
    } = session;
    const text = readText(repository.root, GITATTRIBUTES_FILE, reads) ?? '';
    const span = blockSpan(text, { path: GITATTRIBUTES_FILE, style: 'hash' });
    const authored = span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
    if (repository.hasGit) {
        generated.blocks.push(
            { path: GITIGNORE_FILE, block: gitignoreBlock(), style: 'hash' },
            {
                path: GITATTRIBUTES_FILE,
                block: attributesBlock(generated.files, authored),
                style: 'hash',
            },
        );
    }
    if (!settings.rules.enabled) return;
    const block = managedBlock({
        generatedPaths: [...generated.files, ...generated.fileEdits]
            .map(({ path }) => path)
            .filter((path) => !path.startsWith(`${DOT_GSPOT}/`)),
        startCommand: session.startRunner.command,
        files: rules,
        level: settings.level,
        hasChecks: manifests.some((manifest) => manifest.checks.length > 0),
    });
    for (const path of new Set([AGENTS_FILE, ...settings.rules.instruction_files]))
        generated.blocks.push({ path, block, style: 'markdown' });
}

function mergeFileEdits(generated: Generated): void {
    const assembled = new Map<string, Generated['fileEdits'][number]>();
    for (const file of generated.fileEdits) {
        const previous = assembled.get(file.path);
        if (previous === undefined) assembled.set(file.path, { ...file, changes: [...file.changes] });
        else {
            previous.changes.push(...file.changes);
        }
    }
    generated.fileEdits = [...assembled.values()];
}

function assertDistinctPaths(generated: Generated): void {
    const paths = new Map<string, string>();
    const files = [...generated.files, ...generated.blocks, ...generated.fileEdits];
    for (const file of files) {
        assertWritablePath(file.path);
        const key = pathKey(file.path);
        const previous = paths.get(key);
        if (previous !== undefined) throw new Error(`Generated destinations collide: ${previous} and ${file.path}`);
        paths.set(key, file.path);
    }
}

/**
 * The managed .gitignore block for tool projects and generated files.
 * @returns the paths that Git must leave untracked.
 */
export function gitignoreBlock(): string {
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
export function emitAll(session: Session): Generated {
    const {
        settingsFile: { settings },
        repository,
        scopes,
    } = session;
    const { root, files } = repository;
    const npmClient = session.npmClient();
    const manifests = session.neededToolManifests;
    const tools = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const checks = session.configuredChecks;
    const repositoryConsumers = { tools, checks: new Set(checks.map((check) => check.check.name)) };
    const generated: Generated = { notes: [], files: [], blocks: [], fileEdits: [] };
    const seen = new Set<string>();
    for (const selection of scopes) {
        const scopeChecks = checks.filter(
            (check) => check.scope.scope.path === selection.scope.path || check.check.runs === 'once',
        );
        const scopeConsumers = {
            tools: new Set(scopeChecks.flatMap((check) => requiredToolNames(check))),
            checks: new Set(scopeChecks.map((check) => check.check.name)),
        };
        emitToolFiles({ session, files, scopes, manifests, selection }, generated, seen, {
            repository: repositoryConsumers,
            scope: scopeConsumers,
        });
    }
    generated.fileEdits.push(...bunfigChanges(root, scopes), ...packageRedirects(session, generated.files));
    generated.files.push(
        ...hookFiles(root, settings, session.startRunner),
        ...npmProject({ root, scopes, manifests, installer: npmClient }),
        ...pythonProject(manifests),
        miseFile(manifests),
    );
    emitWorkflow(session, generated);
    const selected = everyManifest(scopes);
    const rules = selectRuleFiles(settings.rules, selected, repository, settings.level, session.packageManifests);
    generated.files.push(
        ...rules.map((file) => ({
            path: file.target,
            content: file.content,
            kind: 'rules' as const,
        })),
    );
    emitBlocks(session, selected, rules, generated);
    generated.files.sort((a, b) => a.path.localeCompare(b.path));
    mergeFileEdits(generated);
    assertDistinctPaths(generated);
    return generated;
}
