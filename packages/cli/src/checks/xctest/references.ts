import type { EngineInput } from '#types/run.ts';
// Snapshot references: every folder of references belongs to a test file that exists.
import type { Finding } from '#types/finding.ts';
import { xcodeFinding } from '#cli/checks/xcode/files.ts';

const DEFAULT_FOLDERS = ['__Snapshots__'];
// A reference sits at least this many parts below the snapshot folder: the folder, the test name and the file.
const REFERENCE_DEPTH = 3;

/**
 * One finding for each reference whose folder names no Swift test file beside the snapshot folder.
 * @param input the engine input
 * @returns the findings
 */
export function referenceOwners(input: EngineInput): Promise<Finding[]> {
    const folders = (input.view.tool('xctest')['reference_directories'] as string[] | undefined) ?? DEFAULT_FOLDERS;
    const paths = input.session.repository.files.map((file) => file.path);
    const tests = new Set(
        paths.filter((path) => path.endsWith('.swift')).map((path) => path.slice(0, -'.swift'.length)),
    );
    const findings = paths.flatMap((path): Finding[] => {
        const parts = path.split('/');
        const at = parts.findIndex((part) => folders.includes(part));
        const owner = parts[at + 1];
        if (at === -1 || owner === undefined || parts.length < at + REFERENCE_DEPTH) return [];
        const beside = [...parts.slice(0, at), owner].join('/');
        if (tests.has(beside)) return [];
        return [
            xcodeFinding(
                input,
                { file: path, line: 1 },
                'orphan-reference',
                `No test file ${beside}.swift exists for this reference.`,
            ),
        ];
    });
    return Promise.resolve(findings);
}
