import { join } from 'node:path';
import { statSync } from 'node:fs';
import { findingAt } from '#cli/checks/result.ts';
import { LICENSE_NAMES } from '#cli/config/checks/docs.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';

/**
 * One finding per scope without a README.md, and one when the root has no license file.
 * @param input the engine input
 * @returns the findings
 */
export function readmePresent(input: EngineInput): Finding[] {
    const isLicenseRequired = input.view.tool('docs')['require_license'] !== false;
    const findings: Finding[] = [];
    const readme = input.scope === '' ? 'README.md' : `${input.scope}/README.md`;
    if (statSync(join(input.root, readme), { throwIfNoEntry: false }) === undefined)
        findings.push(
            findingAt(
                input,
                { file: readme },
                'missing-readme',
                `The scope ${input.scope === '' ? 'root' : input.scope} has no README.md.`,
            ),
        );
    if (
        isLicenseRequired &&
        input.scope === '' &&
        LICENSE_NAMES.every((name) => statSync(join(input.root, name), { throwIfNoEntry: false }) === undefined)
    )
        findings.push(findingAt(input, { file: 'LICENSE' }, 'missing-license', 'The root has no LICENSE file.'));
    return findings;
}
