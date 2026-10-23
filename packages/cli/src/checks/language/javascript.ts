import ts from 'typescript';
import { chmodSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { buildBaseResult } from '#cli/runs/report.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import { JSCONFIG_FILE } from '#cli/config/files/names.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { getConfigFile } from '#cli/runs/command/placeholders.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { extractConfigFileName } from '#cli/configurations/tools.ts';
import { TSC_UNFORMATTED_OUTPUT } from '#cli/config/checks/tsc/compiler.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { buildPerScopeTarget } from '#cli/generation/config-files/generate.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/projects/tsconfig.ts';
import { buildJsconfigFile } from '#cli/generation/configurations/language/javascript/jsconfig.ts';
import { JSCONFIG_TSBUILDINFO, JAVASCRIPT_TSC_COMMAND } from '#cli/config/checks/language/javascript.ts';
import { listCompilerFiles, restoreCommandPaths, appendTsbuildinfoFlag } from '#cli/checks/tsc/compiler.ts';

function buildScopeCompilerProject(
    session: Session,
    scope: string,
    config: TypeScriptConfiguration,
): Pick<TypeScriptConfiguration, 'fileNames' | 'options'> {
    const { root, repository } = session;
    const files = new Set(
        repository.files
            .filter(
                (file) => file.kind === 'source' && findScopeFolder(file.path, repository.scopeFolders).path === scope,
            )
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

function findJavascriptProject(session: Session, planned: PlannedCheck): string {
    const configFile = getConfigFile(session, planned, extractConfigFileName(JSCONFIG_FILE));
    const paths = new Set([
        configFile.target,
        ...session.scopes.map(({ folder }) => buildPerScopeTarget(configFile, folder.path)),
    ]);
    using files = openFiles(session.root);
    for (const path of paths) {
        const written = files.read(path);
        if (written === undefined) continue;
        const built = buildJsconfigFile({
            session,
            scope: planned.scope,
            configuration: planned.configuration as Configuration,
            configFile,
            targetPath: path,
            level: session.settingsFile.settings.level,
        });
        if (written.bytes.toString('utf8') === `${formatHeader(path)}${built.trimEnd()}\n`) return path;
    }
    throw new Error(`Missing JavaScript config file: ${configFile.target}`);
}

/**
 * Type-checks JavaScript with the type declarations the project uses.
 *
 * @param session the repository and its tools.
 * @param planned the JavaScript compiler check.
 * @returns the check result.
 */
export async function checkJavascriptTsc(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.scope.folder.path;
    if (listCheckedFiles(session.scopes, planned).length === 0)
        return { ...buildBaseResult(planned, session), fileCount: 0 };
    const target = findJavascriptProject(session, planned);
    const generated = readTsconfig(session.root, join(session.root, target), session.reads);
    if (generated === undefined) throw new Error(`Missing JavaScript config file: ${target}`);
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
    const command = [...JAVASCRIPT_TSC_COMMAND, generatedPath, ...TSC_UNFORMATTED_OUTPUT];
    appendTsbuildinfoFlag(command, project.options, scratch, JSCONFIG_TSBUILDINFO);
    const result = await runCheckCommand(session, planned, {
        command,
        copyRoot: scratch,
    });
    return restoreCommandPaths(result, scratch, session.root);
}
