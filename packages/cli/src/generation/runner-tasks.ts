import type { Manifest } from '#cli/configurations/read-manifests.ts';
import type { GeneratedFile } from '#cli/generation/targets.ts';
import { headerFor } from '#cli/generation/templates.ts';
import { RUNNER_TASKS, type RunnerTask } from '#cli/policy/runner.ts';
import { MISE_CONFIG_PATH, MISE_MIN_VERSION, misePins } from '#cli/tools/mise.ts';
const BARE_KEY = /^[\w-]+$/u;

function tomlKey(name: string): string {
    return BARE_KEY.test(name) ? name : JSON.stringify(name);
}

/**
 * Mise pins and tasks, with npm dependencies kept in the isolated tool project.
 * @param manifests the selected manifests
 * @param version the gspot version
 * @param isPackagePinned whether npm tools are pinned in .gspot/package.json instead
 * @param tasks
 * @returns the generated file
 */
export function miseTasks(
    manifests: Manifest[],
    version: string,
    isPackagePinned: boolean,
    tasks: RunnerTask[] = RUNNER_TASKS,
): GeneratedFile {
    const lines = [
        headerFor(MISE_CONFIG_PATH, version).trimEnd(),
        '',
        `min_version = "${MISE_MIN_VERSION}"`,
        '',
        '[tools]',
        `"github:stefanionescu/gspot" = "${version}"`,
    ];
    for (const pin of misePins(manifests, isPackagePinned)) lines.push(`${tomlKey(pin.name)} = "${pin.version}"`);
    for (const task of tasks)
        lines.push(
            '',
            `[tasks.${JSON.stringify(task.name)}]`,
            `description = ${JSON.stringify(task.description)}`,
            `run = ${JSON.stringify(task.run)}`,
        );
    return { path: MISE_CONFIG_PATH, content: `${lines.join('\n')}\n`, readOnly: true, kind: 'runner' };
}
