// Generates the config files of a sandbox and finds the one of a tool.
import { testdir } from 'testdirs';
import { join, posix } from 'node:path';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import type { Session } from '#cli/types/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { extractConfigFileName } from '#cli/configurations/declared-tools.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';

/** Find the generated config file for a tool and scope. */
export function findConfigFilePath(session: Session, tool: string, scopePath = ''): string {
    const declaration = session.scopes
        .find((scope) => scope.folder.path === scopePath)
        ?.configurations.flatMap((configuration) => configuration.configFiles)
        .find((file) => extractConfigFileName(file.file) === tool);
    if (declaration === undefined)
        throw new Error(`The sandbox generates no ${tool} file for ${scopePath || 'the root'}.`);
    return getConfigFileTarget(scopePath, declaration, getConfigFiles(session).targets);
}

/**
 * Find where gspot writes a config file that a configuration ships, as its manifest declares it.
 *
 * @param configuration the configuration name, such as `javascript`.
 * @param file the config file name in the manifest, such as `knip.json`.
 * @returns the repository path of the root config file.
 */
export function findFileTarget(configuration: string, file: string): string {
    const target = readConfigurations()
        .get(configuration)
        ?.configFiles.find((configFile) => configFile.file === file)?.target;
    if (target === undefined) throw new Error(`The ${configuration} configuration ships no ${file}.`);
    return target;
}

/**
 * Find where gspot writes a rule file for coding agents.
 *
 * @param configuration the configuration name, such as `engineering`.
 * @param file the rule file name, such as `WORKING.md`.
 * @returns the repository path of the rule file.
 */
export function findRuleFileTarget(configuration: string, file: string): string {
    const declared = readConfigurations().get(configuration);
    if (declared === undefined) throw new Error(`No configuration is called ${configuration}.`);
    return posix.join(GSPOT_PATHS.configurations, declared.group, configuration, 'rules', file);
}

/** Read each generated config file matched by a repository-relative glob. */
export async function readGeneratedFiles(root: string, pattern: string): Promise<{ path: string; content: string }[]> {
    return Promise.all(
        [...new Bun.Glob(pattern).scanSync({ cwd: root, dot: true })].map(async (path) => ({
            path: convertToPosixPath(path),
            content: await readFile(join(root, path), 'utf8'),
        })),
    );
}

/**
 * Create a repository with the settings and files, and return the content of one generated file.
 *
 * @param settings the gspot.toml text.
 * @param path generated file to read.
 * @param files other content for the repository.
 * @returns the generated content.
 */
export async function generateFile(settings: string, path: string, files: Record<string, string>): Promise<string> {
    await using sandbox = await testdir({ ...files, 'gspot.toml': settings });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const file = output.files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`The sandbox generates no ${path}.`);
    return file.content;
}
