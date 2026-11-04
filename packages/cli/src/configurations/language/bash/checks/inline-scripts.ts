import type { Session } from '#cli/types/tools.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';
import { RUNTIME_EMBEDS, RUNTIME_EMBED_RULE } from '#cli/config/configurations/bash.ts';

/**
Reports each line that embeds another runtime.

@param session the repository and its tools.
@param planned the scope scripts to read.
*/
async function checkBashInlineScripts(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) =>
        file.code.flatMap((line, position) => {
            const embed = RUNTIME_EMBEDS.find(([pattern]) => pattern.test(line));
            if (embed === undefined) return [];
            return [
                {
                    file: file.path,
                    line: position + 1,
                    rule: RUNTIME_EMBED_RULE,
                    message: `This line carries ${embed[1]}; put it in its own file.`,
                },
            ];
        }),
    );
}

export const BASH_INLINE_SCRIPTS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'bash/inline-scripts': { check: checkBashInlineScripts },
};
