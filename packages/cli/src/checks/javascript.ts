import ts from 'typescript';
import { chmodSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { buildBaseResult } from '#cli/runs/report.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { JSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { getToolFile } from '#cli/runs/command/placeholders.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { WholeToolFile } from '#cli/types/generation/files.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { buildPerScopeTarget } from '#cli/generation/settings/generate.ts';
import { extractToolFileName } from '#cli/configurations/declared-tools.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import { buildJsconfigFile } from '#cli/generation/settings/builders/jsconfig.ts';
import { TSC_PLAIN_OUTPUT, JSCONFIG_TSBUILDINFO, JAVASCRIPT_TSC_COMMAND } from '#cli/config/checks/typescript.ts';
import { listCompilerFiles, restoreCommandPaths, appendTsbuildinfoFlag } from '#cli/checks/typescript/compiler.ts';

/**
 * Selects the source files and type roots of a scope.
 *
 * @param session the source repository or copy.
 * @param scope the folder whose files to keep.
 * @param config the parsed jsconfig.json.
 * @returns the file names and compiler options.
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
            .filter((file) => file.kind === 'source' && findScope(file.path, repository.scopeFolders).path === scope)
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

// A project with references builds them first; a project without them needs no prerequisites.
/**
 * Finds the generated jsconfig of a scope without parsing the authored options of another scope.
 *
 * @param session the repository and settings.
 * @param planned the JavaScript check and its scope.
 * @returns the path of the matching jsconfig.
 */
function findJavascriptProject(session: Session, planned: PlannedCheck): string {
    const toolFile = getToolFile(session, planned, extractToolFileName(JSCONFIG_FILE)) as WholeToolFile;
    const paths = new Set([
        toolFile.target,
        ...session.scopes.map(({ scope }) => buildPerScopeTarget(toolFile, scope.path)),
    ]);
    using files = openFiles(session.root);
    for (const path of paths) {
        const written = files.read(path);
        if (written === undefined) continue;
        const expected = buildJsconfigFile({
            session,
            selection: planned.selection,
            configuration: planned.configuration as Configuration,
            toolFile,
            targetPath: path,
            level: session.settingsFile.settings.level,
        });
        if (written.bytes.toString('utf8') === expected) return path;
    }
    throw new Error(`Missing JavaScript tool file: ${toolFile.target}`);
}

/**
 * Type-checks JavaScript with the type declarations the project uses.
 *
 * @param session the repository and its tools.
 * @param planned the JavaScript compiler check.
 * @returns the check result.
 */
export async function checkJavascriptTsc(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.selection.scope.path;
    if (listCheckedFiles(session.scopes, planned).length === 0)
        return { ...buildBaseResult(planned, session), fileCount: 0 };
    const target = findJavascriptProject(session, planned);
    const generated = readTsconfig(session.root, join(session.root, target), session.reads);
    if (generated === undefined) throw new Error(`Missing JavaScript tool file: ${target}`);
    const project = {
        ...generated,
        ...buildScopeCompilerProject(session, scope, generated),
    };
    if (project.fileNames.length === 0) return { ...buildBaseResult(planned, session), fileCount: 0 };
    const prerequisites = listCompilerFiles(session, [[scope, project]]);
    using folder = await createCheckCopy(session, planned, [target, ...prerequisites]);
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
    appendTsbuildinfoFlag(command, project.options, scratch, JSCONFIG_TSBUILDINFO);
    const result = await runCheckCommand(session, planned, {
        command,
        copyRoot: scratch,
    });
    return restoreCommandPaths(result, scratch, session.root);
}
