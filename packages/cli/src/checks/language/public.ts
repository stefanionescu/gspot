import { parse } from 'smol-toml';
import { join, posix, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { toPosix } from '#cli/platform/contracts.ts';
import { GspotError } from '#cli/platform/public.ts';
import { ownedInputs } from '#cli/planning/public.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { RAN_STATUSES } from '#cli/config/execution/runtime.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { requiredTsconfigOptions } from '#cli/generation/tsconfig.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { inScope, targetInScope } from '#cli/repository/paths/public.ts';
import type { PythonDocstringStyle } from '#cli/types/parsers/python.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';
import { docstringStyleSchema } from '#cli/parsers/schema/python/docstrings.ts';
import { getTsconfig, getTsconfigProject } from '#cli/parsers/packages/public.ts';
import { docstringOf, parsePythonModule } from '#cli/parsers/source/contracts.ts';
import type { DocstringConfiguration } from '#cli/types/checks/language/python.ts';
import { readText, readSource, createReadCache } from '#cli/platform/root/public.ts';

import {
    NUMPY_DOCSTRING,
    PYTHON_MANIFEST,
    GOOGLE_DOCSTRING,
    PYDOCLINT_COMMAND,
    PYDOCLINT_TYPE_OPTIONS,
    PYDOCLINT_DEFAULT_STYLE,
} from '#cli/config/checks/language/python.ts';
import {
    runTsc,
    compilerFiles,
    projectChecked,
    writeScopeProject,
    compilerCopyInputs,
    appendBuildMetadata,
    restoreCommandPaths,
    scopeCompilerProject,
} from '#cli/checks/language/contracts.ts';

async function sourceStyle(session: ToolSession, path: string): Promise<PythonDocstringStyle | undefined> {
    const module = await parsePythonModule(
        path,
        readSource(session.root, path, session.reads).toString('utf8'),
        session,
    );
    try {
        for (const node of module.tree.rootNode.descendantsOfType(['function_definition', 'class_definition'])) {
            const docstring = docstringOf(node);
            if (docstring === undefined) continue;
            if (GOOGLE_DOCSTRING.test(docstring)) return 'google';
            if (NUMPY_DOCSTRING.test(docstring)) return 'numpy';
        }
        return undefined;
    } finally {
        module.tree.delete();
    }
}

async function docstringGroups(session: ToolSession, files: TrackedFile[], declared: PythonDocstringStyle | undefined) {
    const groups = new Map<PythonDocstringStyle | undefined, TrackedFile[]>();
    for (const file of files) {
        const style = declared ?? (await sourceStyle(session, file.path));
        const group = groups.get(style) ?? [];
        group.push(file);
        groups.set(style, group);
    }
    return groups;
}

/**
 * Checks ordinary projects and every project named by a solution configuration.
 * @param session the repository session
 * @param planned the compiler check for one scope
 * @returns compiler findings and the shared tool execution status
 */
export async function tsc(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const project = getTsconfigProject(
        session.root,
        planned.scope.scope.path,
        ownedInputs(session, planned)
            .filter((file) => file.tags.includes('typescript'))
            .map((file) => file.path),
        session.reads,
    );
    const references = (project?.config.projectReferences ?? []).length > 0;
    using source =
        references && project !== undefined
            ? await copyIntoScratch(
                  compilerCopyInputs(
                      session,
                      planned,
                      project.projects,
                      compilerFiles(session, planned, project.projects),
                  ),
              )
            : scratchFolder('gspot-tsc-');
    const isolated = references ? { ...session, root: source.path, reads: createReadCache(source.path) } : session;
    const result = await runTsc(isolated, planned, source.path);
    return restoreCommandPaths(result, source.path, session.root);
}

/**
 * Check JavaScript with the repository's ambient types instead of the tool project installation.
 * @param session the selected repository and tool reads
 * @param planned the JavaScript compiler check
 * @returns compiler diagnostics with source paths and the command status
 */
export async function checkjs(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.scope.scope.path;
    if (ownedInputs(session, planned).length === 0) return { ...emptyResult(planned), fileCount: 0 };
    const jsconfig = planned.manifest?.toolFiles.find(
        (entry) => entry.target === `${CONFIGURATION_DIRECTORY}/jsconfig.json`,
    );
    if (jsconfig === undefined)
        throw new Error(`The javascript configuration declares no ${CONFIGURATION_DIRECTORY}/jsconfig.json target.`);
    const target = targetInScope(scope, jsconfig);
    const generated = getTsconfig(session.root, join(session.root, target), session.reads);
    if (generated === undefined) throw new Error(`Missing JavaScript tool file: ${target}`);
    const project = {
        ...generated,
        ...scopeCompilerProject(session.root, scope, session.repository.scopes, generated),
    };
    const projects = new Map([[join(session.root, target), project]]);
    using scratchFolder = await copyIntoScratch(
        compilerCopyInputs(session, planned, projects, compilerFiles(session, planned, projects)),
    );
    const scratch = scratchFolder.path;
    const options = writeScopeProject(session, scratch, planned, target);
    // A push that changes no JavaScript file leaves the project empty, and the compiler refuses an empty project.
    if (options === undefined)
        return {
            check: planned.check.name,
            scope,
            status: 'passed',
            fileCount: 0,
            findings: [],
            duration: 0,
        };
    const command = ['tsc', '-p', '{tool_file:jsconfig}', '--pretty', 'false'];
    appendBuildMetadata(command, options, scratch, 'jsconfig.check.tsbuildinfo');
    const result = await runCheckCommand(session, planned, {
        command: command,
        workspace: scratch,
    });
    return restoreCommandPaths(result, scratch, session.root);
}

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the check input for the scope
 * @returns the findings
 */
export function tsconfig(input: CheckInput): Finding[] {
    const project = getTsconfigProject(
        input.root,
        input.scope,
        input.files.filter((file) => file.tags.includes('typescript')).map((file) => file.path),
        input.reads,
    );
    const scopeTsconfig =
        project === undefined ? inScope(input.scope, 'tsconfig.json') : toPosix(relative(input.root, project.path));
    const candidates = new Set([
        scopeTsconfig,
        ...input.files
            .map((file) => file.path)
            .filter((path) => {
                const name = posix.basename(path);
                return name.startsWith('tsconfig.') && name.endsWith('.json');
            }),
    ]);
    const required = requiredTsconfigOptions(input.policyFiles.policy.level, input.selection.selected);
    const projects = [...candidates].flatMap((path) => {
        const parsed = getTsconfig(input.root, join(input.root, path), input.reads);
        return parsed === undefined ? [] : [{ path, parsed }];
    });
    const unchecked = projects.filter(
        ({ path }) => !projectChecked(input.reads, input.check.name, join(input.root, path), input.scope, required),
    );
    if (projects.length > 0 && unchecked.length === 0)
        throw new GspotError('skip', ['An ancestor compiler check covers this project.']);
    return unchecked.flatMap(({ path, parsed }) =>
        Object.keys(required)
            .filter((option) => parsed.options[option] !== true)
            .map((option) => ({
                ...findingAt(input, { file: path }, option, `${option} is not on in this tsconfig.`),
                help: 'Enable this compiler option in the authored TypeScript configuration.',
            })),
    );
}

/**
 * Preserve authored pydoclint options, then inherit Ruff style and avoid repeating signature types in prose.
 * @param text the scoped Python project configuration
 * @param convention the scope's Ruff docstring convention
 * @returns native arguments and the declared style, when one exists
 */
export function docstringConfiguration(text: string, convention?: unknown): DocstringConfiguration {
    const { tool } = docstringStyleSchema.parse(parse(text));
    const inherited = tool.ruff.lint.pydocstyle.convention ?? convention;
    const style = tool.pydoclint.style ?? (inherited === 'google' || inherited === 'numpy' ? inherited : undefined);
    const authored = new Set(Object.keys(tool.pydoclint).map((name) => name.replaceAll('_', '-')));
    const defaults = PYDOCLINT_TYPE_OPTIONS.filter((name) => !authored.has(name)).flatMap((name) => [
        `--${name}`,
        'false',
    ]);
    return { command: [...PYDOCLINT_COMMAND, ...defaults], style };
}

/**
 * Check docstrings with their declared style, or detect Google and NumPy sections in source docstrings.
 * @param session the repository and installed tools
 * @param planned the scoped docstring check
 * @returns findings across style batches, preserving earlier findings if a later command fails
 */
export async function pydoclint(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const configured = docstringConfiguration(
        readText(session.root, posix.join(planned.scope.scope.path, PYTHON_MANIFEST)) ?? '',
        planned.scope.view.values['tools.ruff']?.docstring_convention,
    );
    const groups = await docstringGroups(session, planned.files, configured.style);
    const report = emptyResult(planned);
    for (const [style, files] of groups) {
        const result = await runCheckCommand(
            session,
            { ...planned, files },
            {
                command: [...configured.command, '--style', style ?? PYDOCLINT_DEFAULT_STYLE],
            },
        );
        if (groups.size === 1) return result;
        report.duration += result.duration;
        report.findings.push(...result.findings);
        if (!RAN_STATUSES.has(result.status))
            return {
                ...result,
                fileCount: report.fileCount,
                duration: report.duration,
                findings: report.findings,
            };
        if (result.status === 'failed') report.status = 'failed';
    }
    return report;
}
