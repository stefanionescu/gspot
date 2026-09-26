import { stemOf } from '#cli/checks/structure/directories.ts';
import { codeLines } from '#cli/checks/structure/code-lines.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/structure.ts';

import {
    DEPRECATED_ALIAS,
    FORWARDED_SCRIPT,
    FORWARDER_STEM,
    FORWARDING_INTERPRETER,
    FORWARDING_MAX_LINES,
    INLINE_NODE,
} from '#cli/checks/structure/patterns.ts';

/**
 * One finding per policy the script breaks: inline Node, a wrapper stem, a deprecated alias, or a forwarding body.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptPolicy: Analysis = async (context, scripts) => {
    const index = await scripts();
    const findings = [];
    for (const file of index.files) {
        const code = codeLines(file.lines).filter((line) => !line.code.startsWith('#!'));
        const inlineNode = code.find((line) => INLINE_NODE.test(line.code));
        if (inlineNode !== undefined)
            findings.push(
                context.report(
                    file.path,
                    inlineNode.number,
                    'inline-node',
                    'An inline Node snippet belongs in a .js file.',
                ),
            );
        if (FORWARDER_STEM.test(stemOf(file.path)))
            findings.push(
                context.report(
                    file.path,
                    1,
                    'wrapper-name',
                    'The file name says this script is a wrapper; a canonical script has one name.',
                ),
            );
        const alias = file.lines.findIndex((line) => DEPRECATED_ALIAS.test(line));
        if (alias !== -1)
            findings.push(
                context.report(
                    file.path,
                    alias + 1,
                    'deprecated-alias',
                    'A deprecated alias or compatibility wrapper is deleted, not kept.',
                ),
            );
        const forwarding = code.filter(
            (line) => FORWARDING_INTERPRETER.test(line.code) && FORWARDED_SCRIPT.test(line.code),
        );
        if (forwarding.length === 1 && code.length <= FORWARDING_MAX_LINES)
            findings.push(
                context.report(
                    file.path,
                    forwarding[0]?.number ?? 1,
                    'forwarding-wrapper',
                    'This script only forwards to another; call that one directly.',
                ),
            );
    }
    return findings;
};
