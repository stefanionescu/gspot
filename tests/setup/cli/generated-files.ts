import { posix } from 'node:path';
import { testdir } from 'testdirs';
import type { Session } from '#cli/types/session.ts';
import { openSession } from '#cli/planning/session.ts';
import { ROOT_LABEL } from '#tests/config/messages.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { buildConfigFiles } from '#cli/generation/configs.ts';
import { extractConfigFileName } from '#cli/manifests/tools.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { getConfigFileTarget } from '#cli/generation/selection.ts';
import { listRuleFiles, readConfigurations } from '#cli/manifests/read.ts';

/**
Find the generated config file for a tool and scope.
*/
export function getConfigFilePath(session: Session, tool: string, scopePath = ''): string {
    const declaration = session.scopes
        .find((scope) => scope.path === scopePath)
        ?.configurations.flatMap((configuration) => configuration.configFiles)
        .find((file) => extractConfigFileName(file.file) === tool);
    if (declaration === undefined)
        throw new Error(`The sandbox generates no ${tool} file for ${scopePath || ROOT_LABEL}.`);
    return getConfigFileTarget(scopePath, declaration, buildConfigFiles(session));
}

/**
Find where gspot writes the root copy of a config file that a configuration ships, as its manifest declares it.
*/
export function getManifestTarget(configuration: string, file: string): string {
    const target = readConfigurations()
        .get(configuration)
        ?.configFiles.find((configFile) => configFile.file === file)?.target;
    if (target === undefined) throw new Error(`The ${configuration} configuration ships no ${file}.`);
    return target;
}

/**
Find where gspot writes a rule file for coding agents, as the configuration ships it.
*/
export function getRuleFilePath(configuration: string, file: string): string {
    const shipped = readConfigurations().get(configuration);
    const rule =
        shipped === undefined ? undefined : listRuleFiles(shipped).find(({ path }) => posix.basename(path) === file);
    if (rule === undefined) throw new Error(`The ${configuration} configuration ships no rule file ${file}.`);
    return posix.join(GSPOT_PATHS.configurations, rule.path);
}

/**
Create a repository with this gspot.toml text and these files, and return the content of one generated file.
*/
export async function buildGeneratedFile(
    settings: string,
    path: string,
    files: Record<string, string>,
): Promise<string> {
    await using sandbox = await testdir({ ...files, 'gspot.toml': settings });

    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    const file = output.files.find((each) => each.path === path);
    if (file === undefined) throw new Error(`The sandbox generates no ${path}.`);
    return file.content;
}
