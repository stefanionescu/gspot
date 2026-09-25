import { stripVTControlCharacters } from 'node:util';
import type { Finding } from '#cli/checks/result.ts';
import { SkippedCheckError } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';

// Expo Doctor prints each failed check on a line of its own, then the issues it found, then its advice.
const FAILED_CHECK = /^✖ (?<description>.+)$/u;
const BLOCK_END = /^(?:Advice:|✖ .*)?$/u;
// Doctor ends a run that read the project with this count; it exits 0 without it when it cannot read the project.
const SUMMARY = /^\d+\/\d+ checks passed\./u;

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
    const result = await runCheckCommand(input, ['expo-doctor'], { cwd: input.scopeRoot });
    const lines = stripVTControlCharacters(result.stdout)
        .split('\n')
        .map((line) => line.trim());
    const findings = lines.flatMap((line, index): Finding[] => {
        const description = FAILED_CHECK.exec(line)?.groups?.['description'];
        if (description === undefined) return [];
        const rest = lines.slice(index + 1);
        const end = rest.findIndex((next) => BLOCK_END.test(next));
        const issues = end === -1 ? rest : rest.slice(0, end);
        return [
            {
                check: input.spec.name,
                file: path,
                line: 1,
                rule: 'expo-doctor',
                message: [description, ...issues].join(' '),
                fixable: false,
            },
        ];
    });
    if (findings.length === 0 && (result.code !== 0 || !lines.some((line) => SUMMARY.test(line))))
        throw new Error(
            `expo-doctor exited ${String(result.code)}: ${stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim()}`,
        );
    return findings;
}
