import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { Finding } from '#cli/checks/result.ts';
import { stripVTControlCharacters } from 'node:util';
import { MissingToolError } from '#cli/tools/probe.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { SkippedCheckError } from '#cli/checks/result.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';

// Expo Doctor prints each failed check on a line of its own, then the issues it found, then its advice.
const FAILED_CHECK = /^✖ (?<description>.+)$/u;
const BLOCK_END = /^(?:Advice:|✔ .*|✖ .*|\d+\/\d+ checks passed\..*)?$/u;

function hasInstalledExpo(scopeRoot: string): boolean {
    try {
        createRequire(join(scopeRoot, 'package.json')).resolve('expo/package.json');
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') return false;
        throw error;
    }
}

/**
 * Reads the report Expo Doctor prints.
 * @param check the check name
 * @param file the manifest of the project Doctor read
 * @param stdout what Doctor printed
 * @returns one finding for each check Doctor reports as failed, with its issues
 */
export function doctorFindings(check: string, file: string, stdout: string): Finding[] {
    const lines = stripVTControlCharacters(stdout)
        .split('\n')
        .map((line) => line.trim());
    return lines.flatMap((line, index): Finding[] => {
        const description = FAILED_CHECK.exec(line)?.groups?.['description'];
        if (description === undefined) return [];
        const rest = lines.slice(index + 1);
        const end = rest.findIndex((next) => BLOCK_END.test(next));
        const issues = end === -1 ? rest : rest.slice(0, end);
        return [
            { check, file, line: 1, rule: 'expo-doctor', message: [description, ...issues].join(' '), fixable: false },
        ];
    });
}

/**
 * Runs Expo Doctor in a scope that depends on expo.
 * @param input the engine input
 * @returns one finding for each check Doctor reports as failed
 */
export async function expoDoctor(input: EngineInput): Promise<Finding[]> {
    const path = input.scope === '' ? 'package.json' : `${input.scope}/package.json`;
    const manifest = readPackageManifest(input.root, path);
    if ({ ...manifest.devDependencies, ...manifest.dependencies }['expo'] === undefined)
        throw new SkippedCheckError('This scope does not depend on expo, and Expo Doctor reads an Expo project.');
    // Doctor exits 0 without reading a project whose expo package is absent, so the project is checked first.
    if (!hasInstalledExpo(input.scopeRoot))
        throw new MissingToolError('Expo is not installed in this scope; Expo Doctor reads an installed Expo project.');
    const result = await runCheckCommand(input, ['expo-doctor'], { cwd: input.scopeRoot });
    const findings = doctorFindings(input.spec.name, path, result.stdout);
    const said = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    if (result.code !== 0 && findings.length === 0)
        throw new Error(`Expo Doctor exited ${String(result.code)}: ${said}`);
    return findings;
}
