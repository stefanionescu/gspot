import { ENTRY_FUNCTIONS } from '#config/shell.ts';
// A shell function that forwards "$@" to one command. Searched: shellcheck; it has no such rule.
import type { Analysis } from '#types/structure.ts';
import { codeLines } from '#cli/structure/code-lines.ts';

const CALLEE = /^[\w./-]+$/u;
const FORWARDED = ' "$@"';

function forwardedCallee(code: string): string | undefined {
    const command = code.startsWith('exec ') ? code.slice('exec '.length) : code;
    if (!command.endsWith(FORWARDED)) return undefined;
    const callee = command.slice(0, -FORWARDED.length).trim();
    return CALLEE.test(callee) ? callee : undefined;
}

/**
 * One finding per function whose whole body is one call with its own arguments forwarded unchanged.
 * @param context the check context
 * @param shell the shell index
 * @returns the findings
 */
export const callThrough: Analysis = async (context, shell) => {
    const allowed = new Set(
        context.input.session.policyFiles.policy.structure.call_through_allowed.map(
            (entry) => `${entry.file}\n${entry.name}`,
        ),
    );
    const index = await shell();
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            if (ENTRY_FUNCTIONS.includes(entry.name) || allowed.has(`${file.path}\n${entry.name}`)) return [];
            const lines = codeLines(entry.body);
            const callee = lines.length === 1 ? forwardedCallee(lines[0]?.code ?? '') : undefined;
            if (callee === undefined) return [];
            return [
                context.report(
                    file.path,
                    entry.start,
                    'forwards-arguments',
                    `${entry.name} passes its arguments straight through to ${callee}; call ${callee} directly.`,
                ),
            ];
        }),
    );
};
