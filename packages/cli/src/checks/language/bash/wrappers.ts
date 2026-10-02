import { findingAt } from '#cli/execution/finding.ts';
import { codeLines } from '#cli/checks/language/bash/code-lines.ts';
import { stemOf } from '#cli/checks/general/structure/directories.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks.ts';

import {
    INLINE_NODE,
    FORWARDER_STEM,
    DEPRECATED_ALIAS,
    FORWARDED_SCRIPT,
    FORWARDING_MAX_LINES,
    FORWARDING_INTERPRETER,
} from '#cli/config/checks/structure.ts';

/**
 * One finding per policy the script breaks: inline Node, a wrapper stem, a deprecated alias, or a forwarding body.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptPolicy: Analysis = async (context, scripts) => {
    const index = await scripts();
    return index.files.flatMap((file) => {
        const findings = [];
        const code = codeLines(file.lines).filter((line) => !line.code.startsWith('#!'));
        const inlineNode = code.find((line) => INLINE_NODE.test(line.code));
        if (inlineNode !== undefined)
            findings.push(
                findingAt(
                    context.input,
                    { file: file.path, line: inlineNode.number },
                    'inline-node',
                    'An inline Node snippet belongs in a .js file.',
                ),
            );
        if (FORWARDER_STEM.test(stemOf(file.path)))
            findings.push(
                findingAt(
                    context.input,
                    { file: file.path, line: 1 },
                    'wrapper-name',
                    'The file name says this script is a wrapper; a canonical script has one name.',
                ),
            );
        const alias = file.lines.findIndex((line) => DEPRECATED_ALIAS.test(line));
        if (alias !== -1)
            findings.push(
                findingAt(
                    context.input,
                    { file: file.path, line: alias + 1 },
                    'deprecated-alias',
                    'A deprecated alias or compatibility wrapper is deleted, not kept.',
                ),
            );
        const forwarding = code.filter(
            (line) => FORWARDING_INTERPRETER.test(line.code) && FORWARDED_SCRIPT.test(line.code),
        );
        if (forwarding.length === 1 && code.length <= FORWARDING_MAX_LINES)
            findings.push(
                findingAt(
                    context.input,
                    { file: file.path, line: forwarding[0]?.number ?? 1 },
                    'forwarding-wrapper',
                    'This script only forwards to another; call that one directly.',
                ),
            );
        return findings;
    });
};
