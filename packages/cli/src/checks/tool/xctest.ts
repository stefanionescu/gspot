import { join } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { xccovSchema } from '#cli/parsers/schema/xctest.ts';
import { buildPlan } from '#cli/checks/language/swift/plan.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import { FULL_PERCENTAGE } from '#cli/config/platform/runtime.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import { prepareBuild } from '#cli/checks/language/swift/cache.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import type { CoverageFloor, CoverageReport } from '#cli/types/checks/tool/xctest.ts';

import {
    SLEEP_CALLS,
    COMMENT_LINE,
    RECORDING_MODES,
    RECORDING_NAMES,
    SKIP_REASON_ARGUMENT,
} from '#cli/config/checks/tool/xctest.ts';

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

function recordingEnabled(node: Node): boolean {
    const fields = node.type === 'assignment' ? { name: 'target', value: 'result' } : { name: 'name', value: 'value' };
    const name = node.childForFieldName(fields.name);
    const value = node.childForFieldName(fields.value);
    if (name === null || value === null) return false;
    if (node.type === 'value_argument') return name.text === 'record' && RECORDING_MODES.has(value.text);
    return RECORDING_NAMES.has(name.text) && value.type === 'boolean_literal' && value.text === 'true';
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

// Runs the tests with coverage on, then prints the coverage report of the result bundle.
async function measureCoverage(input: CheckInput, buildArgv: string[], bundle: string, cwd: string): Promise<string> {
    const tested = await runCheckTool(
        input,
        [...buildArgv, '-enableCodeCoverage', 'YES', '-resultBundlePath', bundle],
        {
            cwd,
        },
    );
    if (tested.code !== 0)
        throw new Error(
            `Cannot measure coverage because the test run exited ${String(tested.code)}: ${toolOutputDetail(tested, 'The test runner printed no diagnostic.')}`,
        );
    const viewed = await runCheckTool(input, ['xcrun', 'xccov', 'view', '--report', '--json', bundle], { cwd });
    if (viewed.code !== 0)
        throw new Error(
            `The test run wrote no coverage report: ${toolOutputDetail(viewed, 'The coverage viewer printed no diagnostic.')}`,
        );
    return viewed.stdout;
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
 * One finding for each sleep in a test file outside tools.xctest.sleep_allowed.
 * @param input the check input
 * @returns the findings
 */
export async function sleeps(input: CheckInput): Promise<Finding[]> {
    const allowed = (input.view.options('tools.xctest')['sleep_allowed'] as PathAllowance[] | undefined) ?? [];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const files = input.files
        .filter((file) => file.kind === 'source' && file.tags.includes('swift-test'))
        .filter((file) => !isAllowed(input.scope === '' ? file.path : file.path.slice(input.scope.length + 1)))
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
 * One finding for each copy test left in a recording mode.
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
 * The targets under their floor.
 * @param report what xccov printed
 * @param floors the floors of the policy
 * @returns one line of text for each target under its floor, or missing from the report
 */
export function coverageShortfalls(report: CoverageReport, floors: CoverageFloor[]): string[] {
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
 * Runs the tests with coverage and compares each named target with its floor. The planner requires configured floors.
 * @param input the check input
 * @returns the findings
 */
export async function xctestCoverage(input: CheckInput): Promise<Finding[]> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const project = input.view.options('tools.xcode')['project'];
    if (typeof project !== 'string' || project === '')
        throw new Error(
            'Select the xcode configuration and set tools.xcode.project and tools.xcode.scheme before measuring XCTest coverage.',
        );
    const floors = input.view.options('tools.xctest')['coverage'] as CoverageFloor[];
    const plan = buildPlan(input, 'coverage');
    const bundle = join(plan.folder, 'coverage.xcresult');
    const prepared = prepareBuild(input, plan.folder);
    using files = prepared.files;
    const { source } = prepared;
    const cwd = join(source, input.scope);
    files.removeTree('coverage.xcresult');
    const output = await measureCoverage(input, plan.argv, bundle, cwd);
    const report = xccovSchema.parse(JSON.parse(output));
    return coverageShortfalls(report, floors).map((text) => findingAt(input, { file: '', line: 1 }, 'coverage', text));
}

/**
 * Report references whose layout names no Swift test file in the same directory.
 * @param input the scoped files and copy layout
 * @returns the orphan reference findings
 */
export function xctestReferences(input: CheckInput): Finding[] {
    const layout = input.view.options('tools.xctest')['reference_layout'] as string;
    const pattern = layout
        .split(/(\{file\}|\{test\}|\*|\?)/u)
        .map((part) => {
            if (part === '{file}') return '(?<file>[^/]+)';
            if (part === '{test}') return '[^/]+';
            if (part === '*') return '[^/]*';
            if (part === '?') return '[^/]';
            return RegExp.escape(part);
        })
        .join('');
    const reference = new RegExp(`^(?<base>(?:[^/]+/)*)${pattern}$`, 'u');
    const owners = new Map<string, RegExp[]>();
    for (const file of input.files.filter((file) => file.tags.includes('swift-test'))) {
        const at = file.path.lastIndexOf('/') + 1;
        const base = file.path.slice(0, at);
        const name = file.path.slice(at, -'.swift'.length);
        const patterns = owners.get(base) ?? [];
        patterns.push(new RegExp(`^${pattern.replace('(?<file>[^/]+)', () => RegExp.escape(name))}$`, 'u'));
        owners.set(base, patterns);
    }
    return input.files.flatMap(({ path }): Finding[] => {
        const match = reference.exec(path);
        if (!match?.groups) return [];
        const base = match.groups['base'] ?? '';
        if (owners.get(base)?.some((owner) => owner.test(path.slice(base.length))) === true) return [];
        const owner = `${base}${match.groups['file'] ?? ''}.swift`;
        return [
            findingAt(
                input,
                { file: path, line: 1 },
                'orphan-reference',
                `No test file ${owner} exists for this reference.`,
            ),
        ];
    });
}
