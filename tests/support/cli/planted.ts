import { run } from '#tests/support/cli/command.ts';
import { plant } from '#tests/support/cli/preservation.ts';
import type { PlantedInput, SpawnOutcome } from '#tests/types/cli.ts';

/** A clean bash script every planted repository starts from. */
export const script =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# gspot-ignore structure/trivial-function -- reason: Bash script policy requires this main entry point.\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';

/**
 * Plants one defect in an installed repository, runs its check alone, and restores the repository.
 * @param cwd the planted repository, already installed
 * @param planted the defect
 * @param environment extra variables, such as the PATH of the tools
 * @returns the exit code and the output of the check
 */
export async function runPlanted(
    cwd: string,
    planted: PlantedInput & { expected?: string | { file: string } },
    environment: Record<string, string>,
): Promise<SpawnOutcome> {
    const restore = plant(cwd, planted);
    try {
        return await run(cwd, ['check', '--only', planted.check, '--no-cache'], environment);
    } finally {
        restore();
    }
}
