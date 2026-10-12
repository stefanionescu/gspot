import type ts from 'typescript';
import { toPosix } from '#cli/system/paths.ts';
import { memo } from '#cli/system/file-reads.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { emptyResult } from '#cli/execution/report.ts';
import { coveredInputs } from '#cli/planning/checks.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import type { TsconfigInput } from '#cli/types/generation/typescript.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { TSBUILDINFO_FLAG } from '#cli/config/checks/language/typescript.ts';
import { DOT_GSPOT, TOOL_FILE_DIRECTORY } from '#cli/config/system/locations.ts';
import { buildTsconfig, requiredTsconfigOptions } from '#cli/generation/tsconfig.ts';

import {
    TSCONFIG_FILE,
    TSC_PLAIN_OUTPUT,
    TSC_BUILD_COMMAND,
    TSC_PROJECT_COMMAND,
    TSCONFIG_TSBUILDINFO,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/parsers/tsconfig.ts';

const CHECKED_PROJECTS = { create: () => new Map<string, string>() };

/**
 * Keep incremental metadata inside the caller's scratch folder.
 * @param command the compiler argv.
 * @param options the resolved options.
 * @param scratch the owned metadata directory.
 * @param name the metadata basename.
 */
export function appendBuildMetadata(
    command: string[],
    options: ts.CompilerOptions | undefined,
    scratch: string,
    name: string,
): void {
    if (options?.incremental !== true && options?.composite !== true) return;
    command.push(TSBUILDINFO_FLAG, join(scratch, DOT_GSPOT, name));
}

/**
 * Restore source paths in a compiler run in a scratch copy.
 * @param result the result, which may have no launched command.
 * @param scratch the scratch copy root.
 * @param root the source root.
 * @returns the result with source command paths.
 */
export function restoreCommandPaths(result: CheckResult, scratch: string, root: string): CheckResult {
    if (result.command === undefined) return result;
    return {
        ...result,
        command: result.command.map((part) => part.replaceAll(scratch, () => root)),
    };
}

/**
 * Share ancestor checks without suppressing another invocation for the same scope.
 * @param reads the run cache.
 * @param check the compiler or option check identity.
 * @param path the project path.
 * @param scope the invoking scope.
 * @param required the compiler flags for one scope.
 * @returns whether another scope already checks this project with these flags.
 */
export function projectChecked(
    reads: ReadCache,
    check: string,
    path: string,
    scope: string,
    required: Record<string, boolean>,
): boolean {
    const checked = memo(reads, CHECKED_PROJECTS);
    const key = JSON.stringify([
        check,
        path,
        Object.entries(required).toSorted(([left], [right]) => left.localeCompare(right)),
    ]);
    const earlier = checked.get(key);
    if (earlier !== undefined && earlier !== scope) return true;
    checked.set(key, scope);
    return false;
}

/**
 * Run the compiler in an already selected project, with metadata in the caller's owned folder.
 * @param session the source or scratch copy session.
 * @param planned the compiler declaration for one scope.
 * @param metadataRoot the caller-owned metadata lifetime.
 * @returns compiler diagnostics and execution status.
 */
export async function runTsc(session: Session, planned: PlannedCheck, metadataRoot: string): Promise<CheckResult> {
    const project = readTsconfigProject(
        session.root,
        planned.scope.scope.path,
        coveredInputs(session, planned)
            .filter((file) => file.tags.includes('typescript'))
            .map((file) => file.path),
        session.reads,
    );
    const required = Object.fromEntries(
        Object.entries(requiredTsconfigOptions(session.settingsFile.settings.level, planned.scope.selected)).filter(
            ([name]) => !planned.scope.view.rulesOff(TYPESCRIPT_TSCONFIG_CHECK).includes(name),
        ),
    );
    const target = project === undefined ? join(session.root, planned.scope.scope.path, TSCONFIG_FILE) : project.path;
    if (projectChecked(session.reads, planned.check.name, target, planned.scope.scope.path, required))
        return { ...emptyResult(planned), status: 'skipped', note: 'An ancestor compiler check covers this project.' };
    const command: string[] = [];
    if (project !== undefined && (project.config.projectReferences ?? []).length > 0) {
        command.push(...TSC_BUILD_COMMAND, project.path);
    } else {
        const generatedPath = join(metadataRoot, TOOL_FILE_DIRECTORY, planned.scope.scope.path, TSCONFIG_FILE);
        writeTsconfig({
            root: session.root,
            typeRootsFolder: session.installedRoot ?? session.root,
            reads: session.reads,
            target: toPosix(relative(session.root, generatedPath)),
            scope: planned.scope.scope.path,
            files: session.repository.files,
            scopeEntries: session.repository.scopes,
            options: required,
        });
        command.push(...TSC_PROJECT_COMMAND, generatedPath);
        appendBuildMetadata(command, project?.config.options, metadataRoot, TSCONFIG_TSBUILDINFO);
    }
    command.push(...TSC_PLAIN_OUTPUT);
    return runCheckCommand(session, planned, { command, scratchRoot: session.root });
}

/**
 * Write the compiler project for a caller-owned runtime folder.
 * @param input the source project and relative runtime target.
 * @returns the absolute runtime configuration path.
 */
export function writeTsconfig(input: TsconfigInput): string {
    const target = join(input.root, input.target);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(buildTsconfig(input)));
    return target;
}
