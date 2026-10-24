import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { RUNTIME_EMBEDS } from '#cli/config/checks/language/bash/inline-scripts.ts';

/**
Reports each line that embeds another runtime.

@param session the repository and its tools.
@param planned the scope scripts to read.
@returns the findings.
*/
export async function checkBashInlineScripts(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) =>
        file.code.flatMap((line, position) => {
            const embed = RUNTIME_EMBEDS.find(([pattern]) => pattern.test(line));
            if (embed === undefined) return [];
            return [
                buildFinding(
                    planned,
                    { file: file.path, line: position + 1 },
                    'runtime-embed',
                    `This line carries ${embed[1]}; put it in its own file.`,
                ),
            ];
        }),
    );
}
