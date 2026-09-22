// Every scope has a README, and the root has a license.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';

const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];

/**
 * One finding per scope without a README.md, and one when the root has no license file.
 * @param input the engine input
 * @returns the findings
 */
export function readmePresent(input: EngineInput): Promise<Finding[]> {
    const isLicenseRequired = input.view.tool('docs')['require_license'] !== false;
    const findings: Finding[] = [];
    const readme = input.scope === '' ? 'README.md' : `${input.scope}/README.md`;
    if (!existsSync(join(input.root, readme)))
        findings.push({
            check: input.spec.name,
            file: readme,
            message: `The scope ${input.scope === '' ? 'root' : input.scope} has no README.md.`,
            fixable: false,
        });
    if (isLicenseRequired && input.scope === '' && LICENSE_NAMES.every((name) => !existsSync(join(input.root, name))))
        findings.push({
            check: input.spec.name,
            file: 'LICENSE',
            message: 'The root has no LICENSE file.',
            fixable: false,
        });
    return Promise.resolve(findings);
}
