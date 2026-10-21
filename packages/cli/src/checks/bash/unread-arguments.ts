import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { readScripts } from '#cli/checks/bash/scripts.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';

/**
 * Reports each function called with more arguments than it reads.
 *
 * @param session the repository and its tools.
 * @param planned the scope scripts to read.
 * @returns the findings.
 */
export async function checkBashUnreadArguments(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scripts = await readScripts(session, planned);
    const names = new Set(scripts.flatMap((file) => file.functions.map((entry) => entry.name)));
    const widest = new Map<string, number>();
    for (const file of scripts)
        for (const call of file.calls) {
            if (!call.forwards && names.has(call.name))
                widest.set(call.name, Math.max(widest.get(call.name) ?? 0, call.count));
        }
    return scripts.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const width = widest.get(entry.name) ?? 0;
            const highest = entry.highestRead;
            if (width <= highest) return [];
            const unread = Array.from({ length: width - highest }, (_, offset) => String(highest + offset + 1));
            const read = highest === 0 ? 'reads no positional parameter' : `reads none past $${String(highest)}`;
            const positions =
                unread.length === 1 ? `position ${unread.join('')} is` : `positions ${unread.join(' and ')} are`;
            return [
                buildFinding(
                    planned,
                    { file: file.path, line: entry.start },
                    'unread-arguments',
                    `${entry.name} is called with up to ${String(width)} ${width === 1 ? 'argument' : 'arguments'} but ${read}: ${positions} never read.`,
                ),
            ];
        }),
    );
}
