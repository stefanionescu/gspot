// Generates the config files of a sandbox and finds the one of a tool.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import type { Session } from '#cli/types/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';
import { getToolFileTarget } from '#cli/generation/settings/needed.ts';
import { extractToolFileName } from '#cli/configurations/declared-tools.ts';

/** Find the generated tool file for a tool and scope. */
export function findToolFilePath(session: Session, tool: string, scopePath = ''): string {
    const declaration = session.scopes
        .find((scope) => scope.folder.path === scopePath)
        ?.configurations.flatMap((configuration) => configuration.toolFiles)
        .find((file) => extractToolFileName(file.file) === tool);
    if (declaration === undefined)
        throw new Error(`The sandbox generates no ${tool} file for ${scopePath || 'the root'}.`);
    return getToolFileTarget(scopePath, declaration, getToolFiles(session).targets);
}

/** Read each generated tool file matched by a repository-relative glob. */
export async function readGeneratedFiles(root: string, pattern: string): Promise<{ path: string; content: string }[]> {
    return Promise.all(
        [...new Bun.Glob(pattern).scanSync({ cwd: root, dot: true })].map(async (path) => ({
            path: convertToPosixPath(path),
            content: await readFile(join(root, path), 'utf8'),
        })),
    );
}

/**
 * Creates a repository with the settings and files, and returns the content of one generated file.
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
