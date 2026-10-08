import ts from 'typescript';
import { parse } from 'smol-toml';
import { join, posix, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { toPosix } from '#cli/platform/contracts.ts';
import { emptyResult } from '#cli/execution/report.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { getTsconfig } from '#cli/parsers/packages/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { RAN_STATUSES } from '#cli/config/execution/runtime.ts';
import { targetInScope } from '#cli/configurations/contracts.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { requiredTsconfigOptions } from '#cli/generation/tsconfig.ts';
import { writeScopeProject } from '#cli/checks/language/contracts.ts';
import type { PythonDocstringStyle } from '#cli/types/parsers/python.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';
import { docstringStyleSchema } from '#cli/parsers/schema/python/docstrings.ts';
import { docstringOf, parsePythonModule } from '#cli/parsers/source/contracts.ts';
import type { DocstringConfiguration } from '#cli/types/checks/language/python.ts';
import { copyIntoScratch, projectCopyInputs } from '#cli/execution/copy/public.ts';
import { DOT_GSPOT, CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';
import { openRoot, readText, readSource, createReadCache } from '#cli/platform/root/public.ts';

import {
    NUMPY_DOCSTRING,
    PYTHON_MANIFEST,
    GOOGLE_DOCSTRING,
    PYDOCLINT_COMMAND,
    PYDOCLINT_TYPE_OPTIONS,
    PYDOCLINT_DEFAULT_STYLE,
} from '#cli/config/checks/language/python.ts';

// Both source reads and emitted paths must stay inside the disposable project tree.
function assertOutputsInside(root: string, config: ts.ParsedCommandLine, files: Root): void {
    for (const file of config.fileNames) {
        files.assertInside(toPosix(relative(root, file)));
        if (config.options.noEmit === true) continue;
        for (const output of ts.getOutputFileNames(config, file, !ts.sys.useCaseSensitiveFileNames))
            files.stat(toPosix(relative(root, output)));
    }
    const metadata = ts.getTsBuildInfoEmitOutputFilePath(config.options);
    if (metadata !== undefined) files.stat(toPosix(relative(root, metadata)));
}

// Incremental checks write metadata only inside their disposable folder.
function appendBuildMetadata(
    command: string[],
    options: ts.CompilerOptions | undefined,
    scratch: string,
    name: string,
): void {
    if (options?.incremental !== true && options?.composite !== true) return;
    command.push('--tsBuildInfoFile', join(scratch, DOT_GSPOT, name));
}

function assertBuildInside(root: string, path: string, reads: ReadCache, visited = new Set<string>()): void {
    if (visited.has(path)) return;
    visited.add(path);
    const config = getTsconfig(root, path, reads);
    if (config === undefined) throw new Error(`Missing TypeScript project: ${path}`);
    using files = openRoot(root, 'native');
    assertOutputsInside(root, config, files);
    for (const reference of config.projectReferences ?? [])
        assertBuildInside(root, ts.resolveProjectReferencePath(reference), reads, visited);
}

// Restore every scratch path in the recorded invocation while retaining a result with no launched command.
function restoreCommandPaths(result: CheckResult, scratch: string, root: string): CheckResult {
    if (result.command === undefined) return result;
    return {
        ...result,
        command: result.command.map((part) => part.replaceAll(scratch, () => root)),
    };
}

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
    const target = join(planned.scope.scope.path, 'tsconfig.json');
    const config = getTsconfig(session.root, join(session.root, target), session.reads);
    const hasReferences = (config?.projectReferences ?? []).length > 0;
    const command = [
        'tsc',
        ...(hasReferences ? ['-b'] : ['--noEmit', '-p', '{tool_file:tsconfig}']),
        '--pretty',
        'false',
    ];
    using source = hasReferences
        ? await copyIntoScratch(
              projectCopyInputs(
                  session.root,
                  session.repository.files.map((file) => file.path),
                  session.repository.scopes.map((scope) => scope.path),
              ),
          )
        : scratchFolder('gspot-tsc-');
    const scratch = source.path;
    if (hasReferences) assertBuildInside(scratch, join(scratch, target), createReadCache(scratch));
    else appendBuildMetadata(command, config?.options, scratch, 'tsconfig.tsbuildinfo');
    const result = await runCheckCommand(session, planned, {
        command,
        workspace: hasReferences ? scratch : session.root,
    });
    return restoreCommandPaths(result, scratch, session.root);
}

/**
 * Check JavaScript with the repository's ambient types instead of the tool project installation.
 * @param session the selected repository and tool reads
 * @param planned the JavaScript compiler check
 * @returns compiler diagnostics with source paths and the command status
 */
export async function checkjs(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.scope.scope.path;
    const jsconfig = planned.manifest?.toolFiles.find(
        (entry) => entry.target === `${CONFIGURATION_DIRECTORY}/jsconfig.json`,
    );
    if (jsconfig === undefined)
        throw new Error(`The javascript configuration declares no ${CONFIGURATION_DIRECTORY}/jsconfig.json target.`);
    const target = targetInScope(scope, jsconfig);
    using scratchFolder = await copyIntoScratch(
        projectCopyInputs(
            session.root,
            [...session.repository.files.map((file) => file.path), target],
            session.repository.scopes.map((entry) => entry.path),
        ),
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
    const scopeTsconfig = input.scope === '' ? 'tsconfig.json' : `${input.scope}/tsconfig.json`;
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
    return [...candidates].flatMap((path) => {
        const parsed = getTsconfig(input.root, join(input.root, path), input.reads);
        if (parsed !== undefined)
            return Object.keys(required)
                .filter((option) => parsed.options[option] !== true)
                .map((option) => ({
                    ...findingAt(input, { file: path }, option, `${option} is not on in this tsconfig.`),
                    help: 'Enable this compiler option in the authored TypeScript configuration.',
                }));
        return [];
    });
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
        planned.scope.view.settings['tools.ruff.docstring_convention'],
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
