import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import { FULL_PERCENTAGE } from '#cli/config/platform/runtime.ts';
import { measureCoverage } from '#cli/checks/language/swift/coverage.ts';
import type { SettingOptions } from '#cli/types/policy/setting-values.ts';
import type { CoverageReport } from '#cli/types/parsers/swift/coverage.ts';
import { SLEEP_CALLS, COMMENT_LINE, SKIP_REASON_ARGUMENT } from '#cli/config/checks/tool/xctest.ts';

function hasReason(value: Node | undefined): boolean {
    if (value === undefined || value.text === 'nil') return false;
    if (!value.type.endsWith('string_literal')) return true;
    const literal = /^(#*)("""|")([\s\S]*)\2\1$/u.exec(value.text);
    if (literal === null) return true;
    const whitespace = new RegExp(`\\\\${literal[1] ?? ''}[nrt0]`, 'gu');
    return (literal[3] ?? '').replaceAll(whitespace, ' ').trim() !== '';
}

function skipReason(call: Node, position: number): Node | undefined {
    const argumentsNode = call.namedChildren
        .find((node) => node.type === 'call_suffix')
        ?.namedChildren.find((node) => node.type === 'value_arguments');
    const positional =
        argumentsNode?.namedChildren.filter(
            (node) => node.type === 'value_argument' && node.childForFieldName('name') === null,
        ) ?? [];
    return positional[position]?.childForFieldName('value') ?? undefined;
}

function disabledNodes(root: Node, lines: string[]): Node[] {
    const calls = root.descendantsOfType('call_expression').filter((call) => {
        const name = call.firstNamedChild?.text.replace(/^XCTest\./u, '') ?? '';
        const position = SKIP_REASON_ARGUMENT.get(name);
        if (position === undefined) return false;
        return !hasReason(skipReason(call, position));
    });
    const attributes = root.descendantsOfType('attribute').filter((attribute) => {
        if (
            attribute.firstNamedChild?.text !== 'available' ||
            !attribute.namedChildren.some((node) => node.type === 'simple_identifier' && node.text === 'unavailable')
        )
            return false;
        const reasonArgument =
            attribute.namedChildren.find((node) => node.text === 'message')?.nextNamedSibling ?? undefined;
        return !hasReason(reasonArgument) && !COMMENT_LINE.test(lines[attribute.startPosition.row - 1] ?? '');
    });
    return [...calls, ...attributes];
}

/**
 * One finding for each skipped test without a reason argument or unavailable declaration without an explanation.
 * @param input the check input
 * @returns the findings
 */
export async function disabled(input: CheckInput): Promise<Finding[]> {
    const files = input.files
        .filter((file) => file.kind === 'source' && file.tags.includes('swift-test'))
        .map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) => {
        for (const node of disabledNodes(source.rootNode, source.text.split('\n')))
            findings.push(
                findingAt(
                    input,
                    { file: source.path, line: node.startPosition.row + 1 },
                    'disabled',
                    'Explain why this test is disabled in its reason argument or availability annotation.',
                ),
            );
    });
    return findings;
}

/**
 * One finding for each sleep in a selected test file.
 * @param input the check input
 * @returns the findings
 */
export async function sleeps(input: CheckInput): Promise<Finding[]> {
    const files = input.files
        .filter((file) => file.kind === 'source' && file.tags.includes('swift-test'))
        .map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) => {
        for (const node of source.rootNode.descendantsOfType('call_expression')) {
            const callee = node.firstNamedChild?.text.replaceAll(/\s/gu, '') ?? '';
            if (!SLEEP_CALLS.has(callee.replace(/^Task<[^>]+>\./u, 'Task.'))) continue;
            findings.push(
                findingAt(
                    input,
                    { file: source.path, line: node.startPosition.row + 1 },
                    'sleep',
                    'Replace this sleep with an expectation that waits for the tested condition.',
                ),
            );
        }
    });
    return findings;
}

/**
 * The targets under their floor.
 * @param report what xccov printed
 * @param settings the common floor and target overrides of the policy
 * @returns one line of text for each target under its floor, or missing from the report
 */
export function coverageShortfalls(
    report: CoverageReport,
    settings: Pick<SettingOptions<'coverage'>, 'lines' | 'overrides'>,
): string[] {
    const floors = [
        ...settings.overrides,
        ...report.targets
            .filter(
                (target) =>
                    !settings.overrides.some(
                        (floor) => target.name === floor.target || target.name === `${floor.target}.app`,
                    ),
            )
            .map((target) => ({ target: target.name, percent: settings.lines })),
    ];
    return floors.flatMap((floor) => {
        const target = report.targets.find(
            (entry) => entry.name === floor.target || entry.name === `${floor.target}.app`,
        );
        if (target === undefined) return [`The coverage report has no target named ${floor.target}.`];
        const covered = Math.floor(target.lineCoverage * FULL_PERCENTAGE);
        return covered >= floor.percent
            ? []
            : [
                  `${floor.target} covers ${String(covered)}% of its lines, under the floor of ${String(floor.percent)}%.`,
              ];
    });
}

/**
 * Runs the tests with coverage and compares each named target with its floor. Uses the common line floor and explicit target overrides.
 * @param input the check input
 * @returns the findings
 */
export async function xctestCoverage(input: CheckInput): Promise<Finding[]> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const settings = input.view.options('coverage');
    const report = await measureCoverage(input);
    return coverageShortfalls(report, settings).map((text) =>
        findingAt(input, { file: '', line: 1 }, 'coverage', text),
    );
}
