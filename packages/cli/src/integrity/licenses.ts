// The license every installed npm package reports, against the allowed list and the exceptions.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';
import type { LicenseException, LicenseReport } from '#types/integrity.ts';

const TOOL = 'license-checker-rseidelsohn';
const EXPRESSION_PARTS = /[()]| OR | AND /u;
const SCAN_TIMEOUT_MS = 300_000;

// A license expression passes when every part of a conjunction, or one part of a choice, is allowed.
function isAllowed(license: string, allow: Set<string>): boolean {
    const parts = license.split(EXPRESSION_PARTS).filter((part) => part.trim() !== '');
    return license.includes(' AND ') ? parts.every((part) => allow.has(part)) : parts.some((part) => allow.has(part));
}

function reported(entry: LicenseReport[string]): string {
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
    if (!existsSync(join(start, 'node_modules'))) return [];
    const binary = locateTool(input.root, TOOL);
    if (binary === undefined) throw new Error(`${TOOL} is not installed; run the install of the runner surface.`);
    const result = await run([binary, '--json', '--excludePrivatePackages', '--start', start], {
        cwd: start,
        timeoutMs: SCAN_TIMEOUT_MS,
    });
    if (result.code !== 0) throw new Error(`${TOOL} did not run: ${result.stderr.trim().split('\n', 1)[0] ?? ''}`);
    const report = JSON.parse(result.stdout) as LicenseReport;
    const manifest = input.scope === '' ? 'package.json' : `${input.scope}/package.json`;
    const tool = input.view.tool('licenses');
    const allow = new Set(tool['allow'] as string[] | undefined);
    const exceptions = new Map(
        ((tool['exceptions'] as LicenseException[] | undefined) ?? []).map((entry) => [entry.package, entry]),
    );
    const finding = (rule: string, text: string): Finding => ({
        check: input.spec.id,
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
