import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { DOCKERIGNORE_ENTRIES } from '#cli/config/checks/tool/docker.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

/**
 * One finding for each Dockerfile folder with no ignore file, or with one that lets a required entry through.
 * @param input the engine input
 * @returns the findings
 */
export function dockerignore(input: EngineInput): Finding[] {
    const dockerfiles = input.files.filter((file) => {
        const name = posix.basename(file.path);
        return name === 'Dockerfile' || name.startsWith('Dockerfile.') || name.endsWith('.dockerfile');
    });
    const folders = new Map(dockerfiles.map((file) => [posix.dirname(file.path), file.path]));
    const findings = folders.entries().flatMap(([folder, dockerfile]): Finding[] => {
        const path = folder === '.' ? '.dockerignore' : `${folder}/.dockerignore`;
        if (statSync(join(input.root, path), { throwIfNoEntry: false }) === undefined)
            return [
                findingAt(
                    input,
                    { file: dockerfile, line: 1 },
                    'missing-file',
                    `No ${path} sits beside this Dockerfile.`,
                ),
            ];
        const text = readSource(input.root, path, input.reads).toString('utf8');
        const lines = new Set(text.split('\n').map((line) => line.trim().replaceAll(/^\/|\/$/gu, '')));
        const missing = DOCKERIGNORE_ENTRIES.filter((entry) =>
            [entry, `**/${entry}`, `${entry}*`, `**/${entry}*`].every((form) => !lines.has(form)),
        );
        if (missing.length === 0) return [];
        return [
            findingAt(
                input,
                { file: path, line: 1 },
                'missing-entry',
                `The ignore file lets through: ${missing.join(', ')}.`,
            ),
        ];
    });
    return findings.toArray();
}
