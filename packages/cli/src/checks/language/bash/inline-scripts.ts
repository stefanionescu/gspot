import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { RUNTIME_EMBEDS, RUNTIME_EMBED_RULE } from '#cli/config/checks/language/bash.ts';

/**
Reports each line that embeds another runtime.

@param session the repository and its tools.
@param planned the scope scripts to read.
*/
export async function checkBashInlineScripts(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
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
