import { RUNTIME_EMBED_RULE, RUNTIME_EMBEDS } from '#cli/config/configurations/bash.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

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
