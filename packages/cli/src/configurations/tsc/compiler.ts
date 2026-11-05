import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import type ts from 'typescript';

import { TSCONFIG_COPY_FOLDER } from '#cli/config/configurations/framework.ts';
import { TSC_UNFORMATTED_OUTPUT } from '#cli/config/configurations/javascript.ts';
import { PARENT_TSCONFIG_SKIP } from '#cli/config/configurations/language.ts';
import {
    TSBUILDINFO_FLAG,
    TSC_BUILD_COMMAND,
    TSC_COMPILER_INPUT_PATHS,
    TSC_CONFIG_INPUT_PATHS,
    TSC_PROJECT_COMMAND,
    TSC_REFERENCE_BUNDLE,
    TSC_REFERENCE_OUTPUT_FOLDER,
    TSCONFIG_TSBUILDINFO,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/configurations/registry.ts';
import { GSPOT_FOLDER, TSCONFIG_FILE } from '#cli/config/parsers.ts';
import { PRIVATE_FILE } from '#cli/config/system.ts';
import { buildTsconfig, selectRequiredTsconfigOptions } from '#cli/configurations/tsc/scope-tsconfig.ts';
import { buildBaseResult } from '#cli/engine/results.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { listSourceFiles, readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import { remember } from '#cli/system/cache.ts';
import { convertToPosixPath, isInside } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import type { TypeScriptReferenceCopy } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckResult, CheckSession } from '#cli/types/engine/run.ts';
import type { ParsedTsconfig, TypeScriptProject } from '#cli/types/parsers.ts';
import type { RunCache } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

const CHECKED_PROJECTS = Symbol('checked projects');

function convertToCopyPath(value: unknown, copy: TypeScriptReferenceCopy): unknown {
    if (Array.isArray(value)) return value.map((path: unknown) => convertToCopyPath(path, copy));
    return typeof value === 'string' && isAbsolute(value) && isInside(relative(copy.root, value))
        ? join(copy.copyRoot, relative(copy.root, value))
        : value;
}

function buildReferenceTsconfig(
    copy: TypeScriptReferenceCopy & { path: string; config: ParsedTsconfig },
): Record<string, unknown> {
    const ts = requireTypescript();
    const { root, copyRoot, path, config } = copy;
    const output = join(copyRoot, GSPOT_FOLDER, TSC_REFERENCE_OUTPUT_FOLDER, relative(root, path));
    const base = (config.options.baseUrl ?? config.options['pathsBasePath']) as string;
    const paths =
        config.options.paths === undefined
            ? undefined
            : Object.fromEntries(
                  Object.entries(config.options.paths).map(([name, aliases]) => {
                      return [name, aliases.map((alias) => convertToCopyPath(resolve(base, alias), copy))];
                  }),
              );
    return {
        ...config.raw,
        ...Object.fromEntries(TSC_CONFIG_INPUT_PATHS.map((name) => [name, convertToCopyPath(config.raw[name], copy)])),
        references: config.projectReferences?.map((reference) => ({
            ...reference,
            path: join(copyRoot, relative(root, ts.resolveProjectReferencePath(reference))),
        })),
        compilerOptions: {
            ...config.raw.compilerOptions,
            ...Object.fromEntries(
                TSC_COMPILER_INPUT_PATHS.map((name) => [name, convertToCopyPath(config.options[name], copy)]),
            ),
            ...(paths !== undefined && { paths }),
            outDir: output,
            ...(config.options.declarationDir !== undefined && { declarationDir: output }),
            ...(config.options.outFile !== undefined && { outFile: join(output, TSC_REFERENCE_BUNDLE) }),
            tsBuildInfoFile: join(output, TSCONFIG_TSBUILDINFO),
        },
    };
}

/**
Points the incremental build information of tsc into the temporary folder, when the project builds incrementally.

@param command the tsc arguments to extend.
@param options the parsed compiler flags.
@param folder the folder for the build information.
@param name the file name of the build information.
*/
export function addTsbuildinfoFlag(
    command: string[],
    options: ts.CompilerOptions | undefined,
    folder: string,
    name: string,
): void {
    if (options?.incremental !== true && options?.composite !== true) return;
    command.push(TSBUILDINFO_FLAG, join(folder, GSPOT_FOLDER, name));
}

/**
Shares a project compile across scopes, but never skips a second run in the same scope. The first scope to start wins.

@param cache the run cache.
@param projectCheck what identifies the compile.
@param projectCheck.check the ID of the planned tsc run.
@param projectCheck.path the tsconfig of the project.
@param projectCheck.scopePath the folder that runs it.
@param projectCheck.required the compiler flags for one scope.
@returns whether this scope owns the project: true when it won the claim, or won it earlier in this run.
*/
export function claimProjectCheck(
    cache: RunCache,
    projectCheck: { check: string; path: string; scopePath: string; required: Record<string, boolean> },
): boolean {
    const { check, path, scopePath, required } = projectCheck;
    const key = JSON.stringify([
        check,
        path,
        Object.entries(required).toSorted(([left], [right]) => compareText(left, right)),
    ]);
    return remember(cache, CHECKED_PROJECTS, key, () => scopePath) === scopePath;
}

/**
Runs tsc on a project and keeps the build information in tsbuildinfoFolder.

@param session the repository or its copy.
@param planned the tsc check for one scope.
@param tsbuildinfoFolder the folder for the build information.
@param project the parsed tsconfig, if any.
*/
export async function runTsc(
    session: CheckSession,
    planned: PlannedCheck,
    tsbuildinfoFolder: string,
    project: TypeScriptProject | undefined,
): Promise<CheckResult> {
    const required = Object.fromEntries(
        Object.entries(selectRequiredTsconfigOptions(session.settings.level, planned.scope.configurations)).filter(
            ([name]) => !listIgnoredRules(planned.scope, TYPESCRIPT_TSCONFIG_CHECK).includes(name),
        ),
    );
    const target = project === undefined ? join(session.root, planned.scope.path, TSCONFIG_FILE) : project.path;
    if (
        !claimProjectCheck(session.cache, {
            check: planned.check.id,
            path: target,
            scopePath: planned.scope.path,
            required,
        })
    )
        return {
            ...buildBaseResult(planned, session),
            status: 'skipped',
            cause: 'replaced',
            note: PARENT_TSCONFIG_SKIP,
        };
    const command: string[] = [];
    if (project !== undefined && (project.config.projectReferences ?? []).length > 0) {
        command.push(...TSC_BUILD_COMMAND, project.path);
    } else {
        const generatedPath = join(tsbuildinfoFolder, TSCONFIG_COPY_FOLDER, planned.scope.path, TSCONFIG_FILE);
        mkdirSync(dirname(generatedPath), { recursive: true });
        writeFileSync(generatedPath, JSON.stringify(buildTsconfig(session, planned.scope, generatedPath)));
        command.push(...TSC_PROJECT_COMMAND, generatedPath);
        addTsbuildinfoFlag(command, project?.config.options, tsbuildinfoFolder, TSCONFIG_TSBUILDINFO);
    }
    command.push(...TSC_UNFORMATTED_OUTPUT);
    return runCommandCheck(session, planned, { command });
}

/**
Rewrites each copied tsconfig so reference builds write their output into the copy.

@param copy the referenced projects and the copy.
*/
export function writeReferenceProjects(copy: TypeScriptReferenceCopy): void {
    const { root, copyRoot, projects, cache } = copy;
    const configurations = new Map([
        ...projects,
        ...projects.values().flatMap((config) =>
            config.extendedTsconfigFiles.map((path) => {
                return [path, readTsconfig(root, path, cache) as ParsedTsconfig] as const;
            }),
        ),
    ]);
    for (const [path, config] of configurations) {
        const target = join(copyRoot, relative(root, path));
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, JSON.stringify(buildReferenceTsconfig({ ...copy, path, config })));
    }
}

/**
Lists the tsconfig files and sources of each project, for the copy.

@param session the repository and run cache.
@param projects each scope path with its parsed tsconfig.
@returns the repository-relative paths.
*/
export function listCompilerFiles(session: Session, projects: Iterable<readonly [string, ParsedTsconfig]>): string[] {
    return [...projects]
        .flatMap(([scopePath, config]) => [
            ...config.tsconfigFiles,
            ...listSourceFiles(session.root, scopePath, session.cache, config).map((source) => source.fileName),
        ])
        .map((path) => convertToPosixPath(relative(session.root, path)))
        .filter(isInside);
}
