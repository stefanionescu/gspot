import { listCodeLines } from '#cli/parsers/bash.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';

import {
    DEPRECATED_ALIAS,
    FORWARDED_SCRIPT,
    FORWARDER_MAX_LINES,
    FORWARDER_INTERPRETER,
} from '#cli/config/checks/language/bash.ts';

/**
 * One finding per deprecated alias or forwarding body.
 * @param input the check context.
 * @returns the findings.
 */
export async function checkBashForwarders(input: CheckInput): Promise<Finding[]> {
    const scripts = await readScripts(input);
    return scripts.flatMap((file) => {
        const findings = [];
        const code = listCodeLines(file.code);
        const alias = file.lines.findIndex((line) => DEPRECATED_ALIAS.test(line));
        if (alias !== -1)
            findings.push(
                buildFinding(
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
                buildFinding(
                    input,
                    { file: file.path, line: forwarding[0]?.number ?? 1 },
                    'forwarding-wrapper',
                    'This script only forwards to another; call that one directly.',
                ),
            );
        return findings;
    });
}
