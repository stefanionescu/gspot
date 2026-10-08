import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import { RECORDING_MODES, RECORDING_NAMES } from '#cli/config/checks/swift-snapshot-testing.ts';

function recordingEnabled(node: Node): boolean {
    const fields = node.type === 'assignment' ? { name: 'target', value: 'result' } : { name: 'name', value: 'value' };
    const name = node.childForFieldName(fields.name);
    const value = node.childForFieldName(fields.value);
    if (name === null || value === null) return false;
    if (node.type === 'value_argument') return name.text === 'record' && RECORDING_MODES.has(value.text);
    return RECORDING_NAMES.has(name.text) && value.type === 'boolean_literal' && value.text === 'true';
}

/**
 * One finding for each snapshot test left in a recording mode.
 * @param input the check input
 * @returns the findings
 */
export async function recording(input: CheckInput): Promise<Finding[]> {
    const files = input.files
        .filter((file) => file.kind === 'source' && file.tags.includes('swift-test'))
        .map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) => {
        for (const node of source.rootNode.descendantsOfType([
            'assignment',
            'property_declaration',
            'value_argument',
        ])) {
            if (!recordingEnabled(node)) continue;
            findings.push(
                findingAt(
                    input,
                    { file: source.path, line: node.startPosition.row + 1 },
                    'recording',
                    'Turn off snapshot recording so this test compares its result with the saved reference.',
                ),
            );
        }
    });
    return findings;
}

/**
 * Report snapshot references whose sibling Swift test source is absent.
 * @param input the scoped source and reference files
 * @returns the orphan reference findings
 */
export function references(input: CheckInput): Finding[] {
    const owners = new Set(input.files.filter((file) => file.tags.includes('swift-test')).map((file) => file.path));
    return input.files.flatMap(({ path }): Finding[] => {
        const folder = posix.dirname(path);
        const base = posix.dirname(folder);
        if (posix.basename(base) !== '__Snapshots__') return [];
        const owner = posix.join(posix.dirname(base), `${posix.basename(folder)}.swift`);
        return owners.has(owner)
            ? []
            : [
                  findingAt(
                      input,
                      { file: path, line: 1 },
                      'orphan-reference',
                      `No test file ${owner} exists for this reference.`,
                  ),
              ];
    });
}
