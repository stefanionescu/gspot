// The license every installed npm package reports, against the allowed list and the exceptions.
import { join } from 'node:path';
import { statSync } from 'node:fs';
import { z } from 'zod';
import satisfies from 'spdx-satisfies';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import parseExpression from 'spdx-expression-parse';
import type { LicenseException } from '#cli/checks/types.ts';

const TOOL = 'license-checker-rseidelsohn';
const licenseSchema = z.object({ licenses: z.union([z.string(), z.array(z.string())]).optional() });
const reportSchema = z.record(z.string(), licenseSchema);

// A license expression passes when every part of a conjunction, or one part of a choice, is allowed.
function isAllowed(license: string, allow: Set<string>): boolean {
    try {
        parseExpression(license);
    } catch {
        return false;
    }
    return satisfies(license, [...allow]);
}

function reported(entry: z.infer<typeof licenseSchema>): string {
    return Array.isArray(entry.licenses) ? entry.licenses.join(' OR ') : (entry.licenses ?? 'UNKNOWN');
}

function verdict(name: string, license: string, exception: LicenseException | undefined): string | undefined {
    if (exception === undefined) return `${name} reports ${license}, which is not an allowed license.`;
    if (exception.license === license) return undefined;
    return `${name} reports ${license}, and its exception names ${exception.license}; the exception no longer holds.`;
}

/**
 * One finding for each installed package whose license is neither allowed nor covered by an exception that still holds.
 * @param input the engine input
 * @returns the findings
 */
export async function licensesNpm(input: EngineInput): Promise<Finding[]> {
    const start = join(input.root, input.scope);
    const dependencies = statSync(join(start, 'node_modules'), { throwIfNoEntry: false });
    if (dependencies?.isDirectory() !== true)
        throw new Error('Dependency licenses cannot be checked before installing the project dependencies.');
    const result = await runCheckCommand(input, [TOOL, '--json', '--excludePrivatePackages', '--start', start], {
        cwd: start,
    });
    if (result.code !== 0) throw new Error(`${TOOL} did not run: ${result.stderr.trim().split('\n', 1)[0] ?? ''}`);
    const report = reportSchema.parse(JSON.parse(result.stdout));
    const manifest = input.scope === '' ? 'package.json' : `${input.scope}/package.json`;
    const tool = input.view.tool('licenses');
    const allow = new Set(tool['allow'] as string[] | undefined);
    const exceptions = new Map(
        ((tool['exceptions'] as LicenseException[] | undefined) ?? []).map((entry) => [entry.package, entry]),
    );
    const finding = (rule: string, text: string): Finding => ({
        check: input.spec.name,
        file: manifest,
        line: 1,
        rule,
        message: text,
        fixable: false,
    });
    const names = Object.keys(report);
    if (names.length === 0)
        return [finding('nothing-scanned', 'The license scan found no package; an empty scan proves nothing.')];
    return names.flatMap((name) => {
        const license = reported(report[name] ?? {});
        if (isAllowed(license, allow)) return [];
        const text = verdict(name, license, exceptions.get(name));
        return text === undefined ? [] : [finding('license', text)];
    });
}
