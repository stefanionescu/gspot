import ts from 'typescript';
import { chmodSync, writeFileSync } from 'node:fs';
import { findScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { checkInput } from '#cli/checks/run/built-in.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { join, posix, dirname, relative } from 'node:path';
import { buildBaseResult } from '#cli/checks/run/report.ts';
import { listCoveredInputs } from '#cli/planning/checks.ts';
import { extractToolFileName } from '#cli/planning/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { type CheckResult } from '#cli/types/checks/run/check.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import type { WholeToolFile } from '#cli/types/generation/files.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { buildJsconfig } from '#cli/generation/tool-files/jsconfig.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { type TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import { readToolFileDeclaration } from '#cli/checks/run/command/placeholders.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/checks/run/copy/scratch.ts';
import { isInside, extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { readTsconfig, listSourceFiles, readTsconfigProject } from '#cli/parsers/tsconfig.ts';

import {
    JSCONFIG_FILE,
    TSC_PLAIN_OUTPUT,
    JSCONFIG_TSBUILDINFO,
    JAVASCRIPT_TSC_COMMAND,
} from '#cli/config/parsers/tsconfig.ts';
import {
    runTsc,
    appendBuildMetadata,
    restoreCommandPaths,
    writeReferenceProjects,
} from '#cli/checks/language/typescript/compiler.ts';

/**
 * Collect each compiler project's inherited configurations and resolved source dependencies.
 * @param session the captured repository and run reads.
 * @param projects the project scopes and parsed configurations.
 * @returns repository-relative compiler inputs for the scratch copy.
 */
function listCompilerInputs(
    session: Session,
    projects: Iterable<readonly [string, TypeScriptConfiguration]>,
): string[] {
    return [...projects]
        .flatMap(([scope, config]) => [
            ...config.tsconfigFiles,
            ...listSourceFiles(session.root, scope, session.reads, config).map((source) => source.fileName),
        ])
        .map((path) => convertToPosixPath(relative(session.root, path)))
        .filter(isInside);
}

/**
 * Select the source files and type declaration folders for one scope.
 * @param session the source repository or scratch copy.
 * @param scope the owning scope.
 * @param config the compiler options.
 * @returns the scope-owned compiler project.
 */
function buildScopeCompilerProject(
    session: Session,
    scope: string,
    config: TypeScriptConfiguration,
): Pick<TypeScriptConfiguration, 'fileNames' | 'options'> {
    const { root, repository } = session;
    // The compiler names its files with forward slashes on every system.
    const files = new Set(
        repository.files
            .filter((file) => file.kind === 'source' && findScope(file.path, repository.scopes).path === scope)
            .map((file) => convertToPosixPath(join(root, file.path))),
    );
    return {
        fileNames: config.fileNames.filter(
            (path) => DECLARATION_EXTENSIONS.includes(extractExtension(path)) || files.has(path),
        ),
        options: {
            ...config.options,
            typeRoots:
                ts.getEffectiveTypeRoots({ ...config.options, configFilePath: join(root, scope, JSCONFIG_FILE) }, {}) ??
                [],
        },
    };
}

function selectReferenceProject(project: ReturnType<typeof readTsconfigProject>) {
    return (project?.config.projectReferences ?? []).length > 0 ? project : undefined;
}

/**
 * Locate one scope's generated project without parsing another scope's authored options.
 * @param session the repository inventory, settings, and generated files.
 * @param planned the JavaScript check and its owning scope.
 * @returns the existing generated project with this scope's content.
 */
function findJavascriptProject(session: Session, planned: PlannedCheck): string {
    const toolFile = readToolFileDeclaration(session, planned, extractToolFileName(JSCONFIG_FILE)) as WholeToolFile;
    const paths = new Set([
        toolFile.target,
        // A tool-file path names a repository file with forward slashes on every system.
        ...session.scopes.map(({ scope }) =>
            posix.join(
                posix.dirname(toolFile.target),
                posix.basename(toolFile.target, posix.extname(toolFile.target)),
                scope.path,
                posix.basename(toolFile.target),
            ),
        ),
    ]);
    using files = openFiles(session.root);
    for (const path of paths) {
        const written = files.read(path);
        if (written === undefined) continue;
        const expected = buildJsconfig({
            session,
            selection: planned.scope,
            manifest: planned.manifest as Manifest,
            scopes: session.scopes,
            files: session.repository.files,
            manifests: session.neededToolManifests,
            toolFile,
            targetPath: path,
            level: session.settingsFile.settings.level,
        });
        if (written.bytes.toString('utf8') === expected) return path;
    }
    throw new Error(`Missing JavaScript tool file: ${toolFile.target}`);
}

/**
 * Checks ordinary projects and every project named by a solution configuration.
 * @param session the repository session.
 * @param planned the compiler check for one scope.
 * @returns compiler findings and the shared tool execution status.
 */
export async function checkTsc(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const project = readTsconfigProject(
        session.root,
        planned.scope.scope.path,
        listCoveredInputs(session, planned)
            .filter((file) => file.tags.includes('typescript'))
            .map((file) => file.path),
        session.reads,
    );
    const references = selectReferenceProject(project);
    const prerequisites =
        references === undefined
            ? []
            : listCompilerInputs(
                  session,
                  [...references.projects].map(([path, config]) => [
                      convertToPosixPath(relative(session.root, dirname(path))),
                      config,
                  ]),
              );
    using source =
        references === undefined
            ? createScratchFolder()
            : await copyIntoScratch(checkCopyInputs(checkInput(session, planned), prerequisites));
    if (references !== undefined) {
        writeReferenceProjects({
            root: session.root,
            scratchRoot: source.path,
            reads: session.reads,
            projects: references.projects,
        });
    }
    const scratchSession =
        references === undefined ? session : { ...session, root: source.path, reads: createReadCache(source.path) };
    const result = await runTsc(
        scratchSession,
        planned,
        source.path,
        references === undefined || project === undefined
            ? project
            : { ...project, path: join(source.path, relative(session.root, project.path)) },
    );
    return restoreCommandPaths(result, source.path, session.root);
}

/**
 * Check JavaScript with the type declarations the project uses.
 * @param session the selected repository and tool reads.
 * @param planned the JavaScript compiler check.
 * @returns compiler diagnostics with source paths and the command status.
 */
export async function checkJavascriptTsc(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.scope.scope.path;
    if (listCoveredInputs(session, planned).length === 0) return { ...buildBaseResult(planned, session), fileCount: 0 };
    const target = findJavascriptProject(session, planned);
    const generated = readTsconfig(session.root, join(session.root, target), session.reads);
    if (generated === undefined) throw new Error(`Missing JavaScript tool file: ${target}`);
    const project = {
        ...generated,
        ...buildScopeCompilerProject(session, scope, generated),
    };
    if (project.fileNames.length === 0) return { ...buildBaseResult(planned, session), fileCount: 0 };
    const prerequisites = listCompilerInputs(session, [[scope, project]]);
    using folder = await copyIntoScratch(checkCopyInputs(checkInput(session, planned), [target, ...prerequisites]));
    const scratch = folder.path;
    const generatedPath = join(scratch, target);
    chmodSync(generatedPath, PRIVATE_FILE);
    writeFileSync(
        generatedPath,
        JSON.stringify({
            ...generated.raw,
            compilerOptions: {
                ...generated.raw.compilerOptions,
                typeRoots: project.options.typeRoots?.map((path) => join(scratch, relative(session.root, path))),
            },
            files: project.fileNames.map((path) =>
                convertToPosixPath(relative(dirname(generatedPath), join(scratch, relative(session.root, path)))),
            ),
            include: [],
            exclude: [],
        }),
    );
    const command = [...JAVASCRIPT_TSC_COMMAND, generatedPath, ...TSC_PLAIN_OUTPUT];
    appendBuildMetadata(command, project.options, scratch, JSCONFIG_TSBUILDINFO);
    const result = await runCheckCommand(session, planned, {
        command: command,
        scratchRoot: scratch,
    });
    return restoreCommandPaths(result, scratch, session.root);
}
