// The Swift test files of a repository, read line by line.
import type { EngineInput } from '#cli/run/types.ts';
import { textOf, trackedEnding } from '#cli/checks/xcode/files.ts';

const TEST_FOLDER = /(?:^|\/)[^/]*Tests\//u;

/**
 * Whether a path sits under a folder named Tests or ending in Tests.
 * @param path the repository-relative path
 * @returns true for a test file
 */
export function isTestPath(path: string): boolean {
    return TEST_FOLDER.test(path);
}

/**
 * Every Swift test file with its lines.
 * @param input the engine input
 * @returns the files
 */
export function testFiles(input: EngineInput): { path: string; lines: string[] }[] {
    return trackedEnding(input, ['.swift'])
        .filter((path) => isTestPath(path))
        .map((path) => ({ path, lines: textOf(input, path).split('\n') }));
}
