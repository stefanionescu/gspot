import { join } from 'node:path';
import { createRequire } from 'node:module';
import { GspotError } from '#cli/platform/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import { parseExpoDoctor } from '#cli/parsers/expo.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { readPackageManifest } from '#cli/repository/package-manifests.ts';

function hasInstalledExpo(scopeRoot: string): boolean {
    try {
        createRequire(join(scopeRoot, 'package.json')).resolve('expo/package.json');
        return true;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return false;
        throw error;
    }
}

/**
 * Runs Expo Doctor in a scope that depends on expo.
 * @param input the check input
 * @returns one finding for each check Doctor reports as failed
 */
export async function expoDoctor(input: CheckInput): Promise<Finding[]> {
    const path = input.scope === '' ? 'package.json' : `${input.scope}/package.json`;
    const manifest = readPackageManifest(input.root, path);
    if (manifest === undefined) throw new Error(`Manifest is missing: ${path}`);
    if ({ ...manifest.devDependencies, ...manifest.dependencies }['expo'] === undefined)
        throw new GspotError('skip', 'This scope does not depend on expo, and Expo Doctor reads an Expo project.');
    // Doctor exits 0 without reading a project whose expo package is absent, so the project is checked first.
    if (!hasInstalledExpo(input.scopeRoot))
        throw new GspotError(
            'tool',
            'Expo is not installed in this scope; Expo Doctor reads an installed Expo project.',
        );
    const result = await runCheckTool(input, ['expo-doctor'], { cwd: input.scopeRoot });
    const findings = parseExpoDoctor(result.stdout).map(
        (diagnostic): Finding => ({
            check: input.check.name,
            file: path,
            line: 1,
            rule: 'failed-check',
            message: diagnostic,
            fixable: false,
        }),
    );
    const output = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    if (result.code !== 0 && findings.length === 0)
        throw new Error(`Expo Doctor exited ${String(result.code)}: ${output}`);
    return findings;
}
