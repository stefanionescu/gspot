import type { Node } from 'web-tree-sitter';
import { readSource } from '#cli/repository/tracked.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { BLOCKING_MODULES, BLOCKING_NAMES } from '#cli/constants/checks/python.ts';

function isBlocking(callee: string): boolean {
    return BLOCKING_NAMES.has(callee) || BLOCKING_MODULES.some((module) => callee.startsWith(module));
}

function isAsync(definition: Node): boolean {
    return definition.children.some((child) => child.type === 'async');
}

// The calls that run on the event loop of this function: a nested plain function runs wherever it is called, so its body is left out.
function callsOf(node: Node): Node[] {
    return node.namedChildren.flatMap((child) => {
        if (child.type === 'function_definition' || child.type === 'lambda') return [];
        return child.type === 'call' ? [child, ...callsOf(child)] : callsOf(child);
    });
}

/**
 * The blocking calls of one parsed file, each with its line and the name called.
 * @param root the root node
 * @returns the calls
 */
export function blockingCalls(root: Node): { line: number; callee: string }[] {
    return root
        .descendantsOfType('function_definition')
        .filter((definition) => isAsync(definition))
        .flatMap((definition) => {
            const body = definition.childForFieldName('body');
            return body === null ? [] : callsOf(body);
        })
        .map((call) => ({ line: call.startPosition.row + 1, callee: call.childForFieldName('function')?.text ?? '' }))
        .filter((call) => isBlocking(call.callee));
}

/**
 * One finding for each blocking call inside an async function.
 * @param input the engine input
 * @returns the findings
 */
export async function pythonBlockingCalls(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (file.nature !== 'source' || !file.path.endsWith('.py')) continue;
        const tree = await parseSource(
            'python',
            readSource(input.root, file.path, input.observations).toString('utf8'),
            input,
        );
        if (tree === null) throw new Error('The source parser returned no tree.');
        try {
            for (const call of blockingCalls(tree.rootNode))
                findings.push({
                    check: input.spec.name,
                    file: file.path,
                    line: call.line,
                    rule: 'blocking-call',
                    message: `${call.callee} blocks the event loop inside an async function.`,
                    fixable: false,
                });
        } finally {
            tree.delete();
        }
    }
    return findings;
}
