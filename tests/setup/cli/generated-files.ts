import { posix } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { extractConfigName } from '#cli/engine/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { getConfigTarget } from '#cli/engine/tool-runs/placeholders.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { listRuleFiles, readConfigurations } from '#cli/manifests/read.ts';
import type { Session } from '#cli/types/tools.ts';
import { ROOT_LABEL } from '#tests/config/setup/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

export function getConfigPath(session: Session, tool: string, scopePath = ''): string {
    const declaration = session.scopes
        .find((scope) => scope.path === scopePath)
        ?.configurations.flatMap((configuration) => configuration.configs)
        .find((file) => extractConfigName(file.file) === tool);
    if (declaration === undefined)
        throw new Error(`The sandbox generates no ${tool} file for ${scopePath || ROOT_LABEL}.`);
    return getConfigTarget(scopePath, declaration, buildConfigs(session));
}

export function getManifestTarget(configuration: string, file: string): string {
    const target = readConfigurations()
        .get(configuration)
        ?.configs.find((config) => config.file === file)?.target;
    if (target === undefined) throw new Error(`The ${configuration} configuration ships no ${file}.`);
    return target;
}

export function getRuleFilePath(configuration: string, file: string): string {
    const shipped = readConfigurations().get(configuration);
    const rule = shipped === undefined ? undefined : listRuleFiles(shipped).find(({ path }) => path === file);
    if (rule === undefined) throw new Error(`The ${configuration} configuration ships no rule file ${file}.`);
    return posix.join(GSPOT_PATHS.rules, rule.path);
}

export async function buildGeneratedFile(
    settings: string,
    path: string,
    files: Record<string, string>,
): Promise<string> {
    await using sandbox = await createGitSandbox({ ...files, 'gspot.toml': settings });

    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    const file = output.files.find((each) => each.path === path);
    if (file === undefined) throw new Error(`The sandbox generates no ${path}.`);
    return file.content;
}
