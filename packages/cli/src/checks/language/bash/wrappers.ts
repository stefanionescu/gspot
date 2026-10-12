import { stemOf } from '#cli/system/paths.ts';
import { codeLines } from '#cli/parsers/bash.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

import {
    FORWARDER_STEM,
    DEPRECATED_ALIAS,
    FORWARDED_SCRIPT,
    FORWARDER_MAX_LINES,
    FORWARDER_INTERPRETER,
} from '#cli/config/checks/language/bash.ts';

/**
 * One finding per wrapper stem, deprecated alias, or forwarding body.
 * @param input the check context.
 * @returns the findings.
 */
export async function bashWrappers(input: CheckInput): Promise<Finding[]> {
    const index = await readScripts(input);
    return index.flatMap((file) => {
        const findings = [];
        const code = codeLines(file.code);
        if (FORWARDER_STEM.test(stemOf(file.path)))
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: 1 },
                    'wrapper-name',
                    'The file name says this script is a wrapper; each script has one name.',
                ),
            );
        const alias = file.lines.findIndex((line) => DEPRECATED_ALIAS.test(line));
        if (alias !== -1)
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: alias + 1 },
                    'deprecated-alias',
                    'Delete this deprecated alias, and call the original script.',
                ),
            );
        const forwarding = code.filter(
            (line) => FORWARDER_INTERPRETER.test(line.text) && FORWARDED_SCRIPT.test(line.text),
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
}
