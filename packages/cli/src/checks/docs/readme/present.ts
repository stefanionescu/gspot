import { join } from 'node:path';
import { statSync } from 'node:fs';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';

const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];

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
        findings.push({
            check: input.spec.name,
            file: readme,
            message: `The scope ${input.scope === '' ? 'root' : input.scope} has no README.md.`,
            fixable: false,
        });
    if (
        isLicenseRequired &&
        input.scope === '' &&
        LICENSE_NAMES.every((name) => statSync(join(input.root, name), { throwIfNoEntry: false }) === undefined)
    )
        findings.push({
            check: input.spec.name,
            file: 'LICENSE',
            message: 'The root has no LICENSE file.',
            fixable: false,
        });
    return findings;
}
