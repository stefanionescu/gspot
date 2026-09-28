import { misePins } from '#cli/tools/mise.ts';
import type { Manifest } from '#cli/types/kits.ts';
import { BARE_KEY } from '#cli/config/generation.ts';
import { headerFor } from '#cli/generation/headers.ts';
import { RUNNER_TASKS } from '#cli/config/policy/policy.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';
import type { RunnerTask } from '#cli/types/policy/policy.ts';
import { MISE_CONFIG_PATH, MISE_MIN_VERSION } from '#cli/config/tools/tools.ts';

/**
 * Mise pins and tasks, with npm dependencies kept in the isolated tool project.
 * @param manifests the selected manifests
 * @param version the gspot version
 * @param isPackagePinned whether the private npm project pins the tools instead
 * @param tasks the task names the policy maps to gspot commands
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
    for (const pin of misePins(manifests, isPackagePinned))
        lines.push(`${BARE_KEY.test(pin.name) ? pin.name : JSON.stringify(pin.name)} = "${pin.version}"`);
    for (const task of tasks)
        lines.push(
            '',
            `[tasks.${JSON.stringify(task.name)}]`,
            `description = ${JSON.stringify(task.description)}`,
            `run = ${JSON.stringify(task.run)}`,
        );
    return { path: MISE_CONFIG_PATH, content: `${lines.join('\n')}\n`, readOnly: true, kind: 'runner' };
}
