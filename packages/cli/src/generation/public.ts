// Assemble generated files and their npm tool project.
import semver from 'semver';
import { join } from 'node:path';
import { miseFile } from '#cli/generation/mise.ts';
import { pathKey } from '#cli/platform/contracts.ts';
import { GspotError } from '#cli/platform/public.ts';
import type { Session } from '#cli/types/planning.ts';
import { readText } from '#cli/platform/root/public.ts';
import { bunfigChanges } from '#cli/generation/bunfig.ts';
import type { RuleFile } from '#cli/types/agent-rules.ts';
import { attributeRules } from '#cli/parsers/attributes.ts';
import { managedBlock } from '#cli/agent-rules/contracts.ts';
import { selectRuleFiles } from '#cli/agent-rules/public.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { emitToolFiles } from '#cli/generation/tool-files.ts';
import { packageRedirects } from '#cli/generation/redirects.ts';
import { etaInputs } from '#cli/generation/compilation/public.ts';
import { toolProjectPins } from '#cli/configurations/contracts.ts';
import { installedDependency } from '#cli/repository/contracts.ts';
import type { NpmProjectInputs } from '#cli/types/generation/npm.ts';
import { GIT_ATTRIBUTES_BLOCK } from '#cli/config/generation/files.ts';
import { hookFiles, pythonProject } from '#cli/generation/contracts.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { githubFile, gitlabFile } from '#cli/generation/documents/public.ts';
import type { Generated, GeneratedFile } from '#cli/types/generation/files.ts';
import { blockSpan, assertMutationTarget } from '#cli/platform/root/contracts.ts';
import { NPM_TOOL_PROJECT, NEXT_ESLINT_PLUGIN } from '#cli/config/parsers/packages.ts';
import { everyManifest, isConfigurationSelected } from '#cli/configurations/public.ts';
import { JSON_INDENT, YARN_TOOL_PROJECT_SETTINGS } from '#cli/config/generation/eta.ts';
import { configuredChecks, requiredToolNames, applicableManifests } from '#cli/planning/public.ts';
import { isYarnBerry, parseToolProject, getPackageInstallerMajor } from '#cli/parsers/packages/contracts.ts';

import {
    DOT_GSPOT,
    UV_LOCKFILE,
    YARN_SETTINGS,
    STATE_DIRECTORY,
    TOOL_PYTHON_PROJECT,
    TOOL_PACKAGE_PROJECT,
    INSTALLATION_DIRECTORIES,
} from '#cli/config/platform/locations.ts';

// CI includes the selected manual checks and adds macOS when a scope selects Swift.
function workflowOutput(policy: Policy, scopes: ScopeSelection[], version: string, generated: Generated): void {
    if (policy.ci === undefined) return;
    const hasSwift = isConfigurationSelected(scopes, 'swift');
    generated.files.push(
        (policy.ci.provider === 'github' ? githubFile : gitlabFile)({
            version,
            run: policy.ci.files,
            setup: policy.ci.setup,
            platforms: policy.ci.platforms,
            hasSwift,
            isMise: policy.runner === 'mise',
            manualChecks: [
                ...new Set(
                    [
                        ...Object.values(policy.check),
                        ...scopes.flatMap((selection) =>
                            selection.selected.flatMap((configuration) => configuration.checks),
                        ),
                    ]
                        .filter((check) => check.stage === 'manual')
                        .map((check) => check.name),
                ),
            ].toSorted((left, right) => left.localeCompare(right)),
        }),
    );
}

// A path as a Git attributes pattern that matches only that file: anchored, with glob characters escaped, and quoted
// when it holds a space or a quote.
function attributePattern(path: string): string {
    const escaped = path.replaceAll(/[\\*?[]/gu, (character) => `\\${character}`);
    const pattern = `/${escaped}`;
    if (!/[\s"]/u.test(pattern)) return pattern;
    const quoted = pattern.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
    return `"${quoted}"`;
}

// Each whole file gspot writes outside its folder keeps LF too, so a CRLF checkout does not read as an edit.
function attributesBlock(files: Generated['files'], authored: string): string {
    if (
        attributeRules(authored, '.').some(
            ({ pattern, attributes }) =>
                pattern === '**/*' && attributes.includes('text=auto') && attributes.includes('eol=lf'),
        )
    )
        return GIT_ATTRIBUTES_BLOCK.split('\n')
            .filter((line) => !line.endsWith(' text eol=lf'))
            .join('\n');
    const outside = files.map(({ path }) => path).filter((path) => !path.startsWith(`${DOT_GSPOT}/`));
    const lines = outside
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) => `${attributePattern(path)} text eol=lf`);
    return [GIT_ATTRIBUTES_BLOCK, ...lines].join('\n');
}

function emitBlocks(session: Session, manifests: Manifest[], rules: RuleFile[], generated: Generated): void {
    const {
        repository,
        policyFiles: { policy },
        reads,
    } = session;
    const text = readText(repository.root, '.gitattributes', reads) ?? '';
    const span = blockSpan(text, { path: '.gitattributes', style: 'hash' });
    const authored = span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
    if (repository.hasGit)
        generated.blocks.push({ path: '.gitignore', block: gitignoreBlock(manifests), style: 'hash' });
    generated.blocks.push({ path: '.gitattributes', block: attributesBlock(generated.files, authored), style: 'hash' });
    if (!policy.agent_rules.enabled) return;
    if (repository.files.some((file) => file.path === 'CLAUDE.md'))
        generated.notes.push('CLAUDE.md text moves to the end of AGENTS.md');
    const block = managedBlock({
        rules: policy.agent_rules,
        files: rules,
        level: policy.level,
        hasChecks: manifests.some((manifest) => manifest.checks.length > 0),
    });
    for (const path of new Set(['AGENTS.md', ...policy.agent_rules.instruction_files]))
        generated.blocks.push({ path, block, style: 'markdown' });
}

function combineToolFiles(generated: Generated): void {
    const assembled = new Map<string, Generated['toolFiles'][number]>();
    for (const file of generated.toolFiles) {
        const previous = assembled.get(file.path);
        if (previous === undefined) assembled.set(file.path, { ...file, changes: [...file.changes] });
        else {
            previous.changes.push(...file.changes);
        }
    }
    generated.toolFiles = [...assembled.values()];
}

function assertDistinctPaths(generated: Generated): void {
    const paths = new Map<string, string>();
    const files = [...generated.files, ...generated.blocks, ...generated.toolFiles];
    for (const file of files) {
        assertMutationTarget(file.path);
        const key = pathKey(file.path);
        const previous = paths.get(key);
        if (previous !== undefined) throw new Error(`Generated destinations collide: ${previous} and ${file.path}`);
        paths.set(key, file.path);
    }
}

/**
 * The managed .gitignore block for tool projects and generated files.
 * @param manifests the selected manifests whose ignored paths count
 * @returns the paths that Git must leave untracked
 */
export function gitignoreBlock(manifests: Iterable<Pick<Manifest, 'ignored'>>): string {
    const toolProjectPaths = [...Object.values(INSTALLATION_DIRECTORIES), STATE_DIRECTORY].map((path) => `${path}/`);
    return [...new Set([...toolProjectPaths, ...[...manifests].flatMap((manifest) => manifest.ignored)])].join('\n');
}

/**
 * Emits every generated file in memory and writes nothing.
 * @param session the repository inventory, effective policy, and selected tools
 * @returns the files, managed blocks, authored config-file edits, and notes
 */
export function emitAll(session: Session): Generated {
    const {
        policyFiles: { policy },
        repository,
        scopes,
        version,
    } = session;
    const { root, files } = repository;
    const packageInstaller = session.packageInstaller();
    const manifests = applicableManifests(session);
    const tools = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const checks = configuredChecks(session, true);
    const repositoryConsumers = { tools, checks: new Set(checks.map((check) => check.check.name)) };
    const generated: Generated = { notes: [], files: [], blocks: [], toolFiles: [] };
    const seen = new Set<string>();
    for (const selection of scopes) {
        const inputs = etaInputs(session, selection, manifests);
        const scopeChecks = checks.filter(
            (check) => check.scope.scope.path === selection.scope.path || check.check.runs === 'once',
        );
        const scopeConsumers = {
            tools: new Set(scopeChecks.flatMap((check) => requiredToolNames(check, session))),
            checks: new Set(scopeChecks.map((check) => check.check.name)),
        };
        emitToolFiles({ root, files, scopes, inputs, selection }, generated, seen, {
            repository: repositoryConsumers,
            scope: scopeConsumers,
        });
    }
    generated.toolFiles.push(...bunfigChanges(root, scopes), ...packageRedirects(session, generated.files));
    generated.files.push(
        ...hookFiles(root, policy, version),
        ...npmProject({ root, scopes, manifests, installer: packageInstaller }),
        ...pythonProject(manifests),
    );
    if (policy.runner === 'mise') generated.files.push(miseFile(manifests, version));
    workflowOutput(policy, scopes, version, generated);
    const selected = everyManifest(scopes);
    const rules = selectRuleFiles(policy.agent_rules, selected, repository, policy.level, session.packageManifests);
    generated.files.push(
        ...rules.map((file) => ({
            path: file.target,
            content: file.content,
            kind: 'rules' as const,
        })),
    );
    emitBlocks(session, selected, rules, generated);
    generated.files.sort((a, b) => a.path.localeCompare(b.path));
    combineToolFiles(generated);
    assertDistinctPaths(generated);
    return generated;
}

/**
 * Every managed destination, including lockfiles owned by applicable tool projects.
 * @param generated the completed generated files
 * @returns the destination paths
 */
export function generatedPaths(generated: Generated): Set<string> {
    const paths = new Set([...generated.files, ...generated.blocks, ...generated.toolFiles].map((file) => file.path));
    for (const file of generated.files) {
        if (file.path === TOOL_PACKAGE_PROJECT) paths.add(parseToolProject(file.content).lockfilePath);
        if (file.path === TOOL_PYTHON_PROJECT) paths.add(UV_LOCKFILE);
    }
    return paths;
}

/**
 * Generate the npm tools as a tool project without adding dependencies to the repository.
 * @param inputs the selected source projects, tool manifests, and package manager.
 * @param inputs.root the repository root.
 * @param inputs.scopes the selected source scopes.
 * @param inputs.manifests the selected tool declarations.
 * @param inputs.installer the repository package manager, or undefined without one.
 * @returns the tool project's files, or none without a package manager.
 */
export function npmProject({ root, scopes, manifests, installer }: NpmProjectInputs): GeneratedFile[] {
    if (installer === undefined) return [];
    const pins = toolProjectPins(manifests).npm;
    const nextVersions = scopes
        .filter(({ selected }) => selected.some(({ configuration }) => configuration.name === 'nextjs'))
        .flatMap(({ scope }) => {
            const version = installedDependency(root, join(scope.path, 'package.json'), 'next')?.version;
            return version === undefined ? [] : [{ scope: scope.path, major: semver.major(version) }];
        });
    const majors = new Set(nextVersions.map(({ major }) => major));
    const requirements = nextVersions
        .map(({ scope, major }) => `${scope || 'the root'} requires ^${String(major)}`)
        .join('; ');
    if (majors.size > 1)
        throw new GspotError('installation', [`Tool pin ${NEXT_ESLINT_PLUGIN} conflicts: ${requirements}.`]);
    const major = majors.values().next().value;
    if (major !== undefined) pins[NEXT_ESLINT_PLUGIN] = `^${String(major)}`;
    const files: GeneratedFile[] = [
        {
            path: TOOL_PACKAGE_PROJECT,
            content: `${JSON.stringify(
                {
                    ...NPM_TOOL_PROJECT,
                    packageManager: `${installer.name}@${String(getPackageInstallerMajor(installer))}.x`,
                    devDependencies: pins,
                },
                null,
                JSON_INDENT,
            )}\n`,
            kind: 'tool_file',
        },
    ];
    if (isYarnBerry(installer))
        files.push({
            path: YARN_SETTINGS,
            content: YARN_TOOL_PROJECT_SETTINGS,
            kind: 'tool_file',
        });
    return files;
}
