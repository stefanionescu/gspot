import type { Node } from 'web-tree-sitter';
import type { Finding } from '#cli/checks/result.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { xcodeFinding } from '#cli/checks/xcode/files.ts';

const COMMENT = /^\s*\/\/\s*\S{3,}/u;
const SLEEP = /^(?:(?:Darwin\.|Glibc\.)?(?:sleep|usleep)|Thread\.sleep|Task(?:<[^>]+>)?\.sleep)$/u;

function hasReason(value: Node | undefined): boolean {
    if (value === undefined || value.text === 'nil') return false;
    if (!value.type.endsWith('string_literal')) return true;
    const literal = /^(#*)("""|")([\s\S]*)\2\1$/u.exec(value.text);
    if (literal === null) return true;
    const whitespace = new RegExp(`\\\\${literal[1] ?? ''}[nrt0]`, 'gu');
    return (literal[3] ?? '').replaceAll(whitespace, ' ').trim() !== '';
}

async function testFindings(
    input: EngineInput,
    rule: string,
    text: string,
    matching: (root: Node, lines: string[]) => Node[],
): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (file.nature !== 'source' || !file.tags.includes('swift-test')) continue;
        const source = readSource(input.root, file.path, input.observations).toString('utf8');
        const tree = await parseSource('swift', source, input);
        if (tree === null) throw new Error('Swift test analysis could not parse the source.');
        try {
            for (const node of matching(tree.rootNode, source.split('\n')))
                findings.push(xcodeFinding(input, { file: file.path, line: node.startPosition.row + 1 }, rule, text));
        } finally {
            tree.delete();
        }
    }
    return findings;
}

/**
 * One finding for each skipped test without a reason argument or unavailable declaration without an explanation.
 * @param input the engine input
 * @returns the findings
 */
export async function disabledTests(input: EngineInput): Promise<Finding[]> {
    return await testFindings(
        input,
        'disabled',
        'This test is turned off and says no reason in its reason argument or availability annotation.',
        (root, lines) => {
            const missing: Node[] = [];
            for (const call of root.descendantsOfType('call_expression')) {
                const name = call.firstNamedChild?.text.replace(/^XCTest\./u, '');
                if (
                    ![
                        'XCTSkip',
                        'XCTSkipIf',
                        'XCTSkipUnless',
                        '.disabled',
                        'ConditionTrait.disabled',
                        'Testing.ConditionTrait.disabled',
                    ].includes(name ?? '')
                )
                    continue;
                const argumentsNode = call.namedChildren
                    .find((node) => node.type === 'call_suffix')
                    ?.namedChildren.find((node) => node.type === 'value_arguments');
                const positional =
                    argumentsNode?.namedChildren.filter(
                        (node) => node.type === 'value_argument' && node.childForFieldName('name') === null,
                    ) ?? [];
                const reason =
                    positional[name === 'XCTSkipIf' || name === 'XCTSkipUnless' ? 1 : 0]?.childForFieldName('value') ??
                    undefined;
                if (!hasReason(reason)) missing.push(call);
            }
            for (const attribute of root.descendantsOfType('attribute')) {
                if (
                    attribute.firstNamedChild?.text !== 'available' ||
                    !attribute.namedChildren.some(
                        (node) => node.type === 'simple_identifier' && node.text === 'unavailable',
                    )
                )
                    continue;
                const message =
                    attribute.namedChildren.find((node) => node.text === 'message')?.nextNamedSibling ?? undefined;
                if (!hasReason(message) && !COMMENT.test(lines[attribute.startPosition.row - 1] ?? ''))
                    missing.push(attribute);
            }
            return missing;
        },
    );
}

/**
 * One finding for each sleep in a test file outside tools.xctest.sleep_allowed.
 * @param input the engine input
 * @returns the findings
 */
export async function noSleep(input: EngineInput): Promise<Finding[]> {
    const allowed = (input.view.tool('xctest')['sleep_allowed'] as { paths: string[] }[] | undefined) ?? [];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const said = 'A test that sleeps is slow when it passes and flaky when it fails; wait on an expectation.';
    const found = await testFindings(input, 'sleep', said, (root) =>
        root
            .descendantsOfType('call_expression')
            .filter((node) => SLEEP.test(node.firstNamedChild?.text.replaceAll(/\s/gu, '') ?? '')),
    );
    return found.filter((finding) => !isAllowed(finding.file));
}

/**
 * One finding for each snapshot test left in a recording mode.
 * @param input the engine input
 * @returns the findings
 */
export async function recordingMode(input: EngineInput): Promise<Finding[]> {
    const said = 'Recording mode is on, so this test writes a new reference and passes whatever the screen shows.';
    return await testFindings(input, 'recording', said, (root) =>
        root.descendantsOfType(['assignment', 'property_declaration', 'value_argument']).filter((node) => {
            if (node.type === 'value_argument')
                return (
                    node.childForFieldName('name')?.text === 'record' &&
                    ['true', '.all', '.missing', '.failed'].includes(node.childForFieldName('value')?.text ?? '')
                );
            const name = node.childForFieldName(node.type === 'assignment' ? 'target' : 'name')?.text;
            const value = node.childForFieldName(node.type === 'assignment' ? 'result' : 'value');
            return (
                ['isRecording', 'SnapshotTesting.isRecording'].includes(name ?? '') &&
                value?.type === 'boolean_literal' &&
                value.text === 'true'
            );
        }),
    );
}
