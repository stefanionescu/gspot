import type { Node } from 'web-tree-sitter';

import {
    buildCommandCalls,
    listScriptCommands,
    listSwallowedLines,
    parseTrapScripts,
} from '#cli/parsers/code/bash/commands.ts';
import { listScriptForms } from '#cli/parsers/code/bash/forms.ts';
import { parseBashFunctions } from '#cli/parsers/code/bash/functions.ts';
import { listTemporaryPaths } from '#cli/parsers/code/bash/temporary-paths.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { blankText, replaceRanges } from '#cli/system/text/positions.ts';
import type { NumberedLine, ParseCache, ScriptSyntax } from '#cli/types/parsers.ts';

function listCommandNodes(root: Node): Node[] {
    return root
        .descendantsOfType(['command', 'declaration_command'])
        .filter((node) => node.type === 'command' || node.child(0)?.text === 'export');
}

export async function parseBashScript(text: string, cache?: ParseCache): Promise<ScriptSyntax> {
    using tree = await parseSource('bash', text, cache);
    const comments = tree.rootNode
        .descendantsOfType('comment')
        .map((comment) => ({ start: comment.startIndex, end: comment.endIndex }));
    const codeText = replaceRanges(text, blankText(text), comments);
    const commands = listCommandNodes(tree.rootNode);
    const trapTrees: Disposable[] = [];
    try {
        const traps = await parseTrapScripts(commands, cache, trapTrees);
        const scripts = new Map(traps.map((script) => [script.trap.id, script]));
        const calls = commands.flatMap((node) => {
            const nodeCalls = buildCommandCalls([node]);
            const script = scripts.get(node.id);
            if (script !== undefined)
                nodeCalls.push(...buildCommandCalls(listCommandNodes(script.syntaxRoot), script.sourceRows));
            return nodeCalls;
        });
        return {
            code: codeText.split('\n'),
            commands: listScriptCommands(commands, traps),
            forms: listScriptForms(tree.rootNode),
            swallowedLines: listSwallowedLines(tree.rootNode, traps),
            statements: tree.rootNode.namedChildren
                .filter((node) => node.type !== 'comment')
                .map((node) => ({ kind: node.type, text: node.text, line: node.startPosition.row + 1 })),
            functions: parseBashFunctions(tree.rootNode),
            calls,
            temporaryPaths: listTemporaryPaths(tree.rootNode, commands, traps),
        };
    } finally {
        for (const trapTree of trapTrees) trapTree[Symbol.dispose]();
    }
}

export function listCodeLines(lines: string[]): NumberedLine[] {
    return lines.flatMap((line, index) => {
        const code = line.trim();
        return code === '' ? [] : { number: index + 1, text: code };
    });
}
