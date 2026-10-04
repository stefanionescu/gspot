import { stemOf } from '#cli/platform/paths.ts';
import { codeLines } from '#cli/parsers/bash.ts';
import { findingAt } from '#cli/execution/finding.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';

import {
    INLINE_NODE,
    FORWARDER_STEM,
    DEPRECATED_ALIAS,
    FORWARDED_SCRIPT,
    FORWARDER_MAX_LINES,
    FORWARDER_INTERPRETER,
} from '#cli/config/checks/language/bash.ts';

/**
 * One finding per policy the script breaks: inline Node, a wrapper stem, a deprecated alias, or a forwarding body.
 * @param input the check context
 * @returns the findings
 */
export const wrappers: Engine = async (input) => {
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) => {
        const findings = [];
        const code = codeLines(file.code).filter((line) => !line.code.startsWith('#!'));
        const inlineNode = code.find((line) => INLINE_NODE.test(line.code));
        if (inlineNode !== undefined)
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: inlineNode.number },
                    'inline-node',
                    'An inline Node snippet belongs in a .js file.',
                ),
            );
        if (FORWARDER_STEM.test(stemOf(file.path)))
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: 1 },
                    'wrapper-name',
                    'The file name says this script is a wrapper; a canonical script has one name.',
                ),
            );
        const alias = file.lines.findIndex((line) => DEPRECATED_ALIAS.test(line));
        if (alias !== -1)
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: alias + 1 },
                    'deprecated-alias',
                    'Delete this deprecated alias, and call the canonical script.',
                ),
            );
        const forwarding = code.filter(
            (line) => FORWARDER_INTERPRETER.test(line.code) && FORWARDED_SCRIPT.test(line.code),
        );
        if (forwarding.length === 1 && code.length <= FORWARDER_MAX_LINES)
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: forwarding[0]?.number ?? 1 },
                    'forwarding-wrapper',
                    'This script only forwards to another; call that one directly.',
                ),
            );
        return findings;
    });
};
