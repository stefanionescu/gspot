import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/result.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { BLOCKING_NAMES, BLOCKING_MODULES } from '#cli/config/checks/python.ts';

// The calls that run on the event loop of this function: a nested plain function runs wherever it is called, so its body is left out.
function callsOf(node: Node): Node[] {
    return node.namedChildren.flatMap((child) => {
        if (child.type === 'function_definition' || child.type === 'lambda') return [];
        return child.type === 'call' ? [child, ...callsOf(child)] : callsOf(child);
    });
}

/**
 * One finding for each blocking call inside an async function.
 * @param input the engine input
 * @returns the findings
 */
export async function pythonBlockingCalls(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (file.kind !== 'source' || !file.path.endsWith('.py')) continue;
        const tree = await parseSource(
            'python',
            readSource(input.root, file.path, input.reads).toString('utf8'),
            input,
        );
        if (tree === null) throw new Error('The source parser returned no tree.');
        try {
            const calls = tree.rootNode
                .descendantsOfType('function_definition')
                .filter((definition) => definition.children.some((child) => child.type === 'async'))
                .flatMap((definition) => {
                    const body = definition.childForFieldName('body');
                    return body === null ? [] : callsOf(body);
                })
                .map((call) => ({
                    line: call.startPosition.row + 1,
                    callee: call.childForFieldName('function')?.text ?? '',
                }))
                .filter(
                    (call) =>
                        BLOCKING_NAMES.has(call.callee) ||
                        BLOCKING_MODULES.some((module) => call.callee.startsWith(module)),
                );
            for (const call of calls)
                findings.push(
                    findingAt(
                        input,
                        { file: file.path, line: call.line },
                        'blocking-call',
                        `${call.callee} blocks the event loop inside an async function.`,
                    ),
                );
        } finally {
            tree.delete();
        }
    }
    return findings;
}
