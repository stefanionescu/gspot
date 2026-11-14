import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { getPosition } from '#cli/system/text/positions.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { listScriptForms } from '#cli/parsers/code/bash/forms.ts';
import { INTERPRETER_COMMANDS } from '#cli/config/parsers/code.ts';
import { LINE_CONTINUATION } from '#cli/config/parsers/projects.ts';
import { NPM_PROGRAM, WHITESPACE_RUN } from '#cli/config/system.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { DockerInstruction } from '#cli/types/configurations/infrastructure.ts';
import { INSTRUCTION_EXPLANATIONS } from '#cli/configurations/infrastructure/docker/explanations.ts';

import {
    NGINX_IMAGE,
    EXEC_FORM_START,
    LOCKED_INSTALLS,
    INSTRUCTION_RULES,
    NPM_INSTALL_VERBS,
    SECOND_INDEX_FLAG,
    DOCKER_INSTRUCTION,
    PATCH_LEVEL_VERSION,
    INSTRUCTION_MESSAGES,
    INSTRUCTION_PATTERNS,
} from '#cli/config/configurations/docker.ts';

function isUnlockedInstall(command: Node): boolean {
    const [verb = '', ...rest] = command.childrenForFieldName('argument').map(({ text }) => text);
    const name = posix.basename(command.childForFieldName('name')?.text ?? '');
    if (name === NPM_PROGRAM) return NPM_INSTALL_VERBS.has(verb) && rest.every((word) => word.startsWith('-'));
    const locked = LOCKED_INSTALLS[name];
    return locked?.verbs.includes(verb) === true && rest.every((word) => !locked.flags.includes(word));
}

/**
List the rules that a RUN script breaks. A download that runs in a shell is the curl-pipe-shell form of the Bash
parser, so this check and bash/safety report the same commands.
*/
async function listRunHits(session: Session, text: string): Promise<Array<keyof typeof INSTRUCTION_RULES>> {
    using tree = await parseSource('bash', text, session);
    return [
        ...tree.rootNode
            .descendantsOfType('command')
            .flatMap((command) => (isUnlockedInstall(command) ? ['lockfile' as const] : [])),
        ...tree.rootNode
            .descendantsOfType('command')
            .flatMap((command) =>
                command.childrenForFieldName('argument').some(({ text }) => SECOND_INDEX_FLAG.test(text))
                    ? ['secondIndex' as const]
                    : [],
            ),
        ...listScriptForms(tree.rootNode)
            .filter(({ form }) => form === 'curl-pipe-shell')
            .map(() => 'pipedDownload' as const),
    ];
}

function hasFloatingNginxTag(text: string): boolean {
    const image = text.split(WHITESPACE_RUN).find((word) => !word.startsWith('--')) ?? '';
    const name = image.split(':', 1)[0] ?? '';
    const tag = image.slice(name.length + 1);
    return !image.includes('@') && NGINX_IMAGE.test(name) && !PATCH_LEVEL_VERSION.test(tag);
}

function listStaticHits({ name, text }: DockerInstruction): Array<keyof typeof INSTRUCTION_RULES> {
    const program = EXEC_FORM_START.exec(text)?.groups?.['program'] ?? '';
    if (name === 'ENTRYPOINT' && INTERPRETER_COMMANDS.has(posix.basename(program))) return ['shellEntrypoint'];
    const patterned = INSTRUCTION_PATTERNS.filter((row) => row.name === name && row.pattern.test(text)).map(
        ({ hit }) => hit,
    );
    return name === 'FROM' && hasFloatingNginxTag(text) ? [...patterned, 'nginxTag'] : patterned;
}

async function checkInstructions(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const instructions = planned.files.flatMap(({ path }) =>
        listDockerInstructions(readText(session.cache, path)).map((instruction) => ({ ...instruction, path })),
    );
    const findings = await Promise.all(
        instructions.map(async (instruction) => {
            const hits =
                instruction.name === 'RUN' ? await listRunHits(session, instruction.text) : listStaticHits(instruction);
            return hits.map((hit) => ({
                file: instruction.path,
                line: instruction.line,
                rule: INSTRUCTION_RULES[hit],
                message: INSTRUCTION_MESSAGES[hit],
            }));
        }),
    );
    return findings.flat();
}

export function listDockerInstructions(text: string): DockerInstruction[] {
    return Array.from(text.matchAll(DOCKER_INSTRUCTION), (match) => ({
        name: (match.groups?.['name'] ?? '').toUpperCase(),
        text: (match.groups?.['text'] ?? '').replaceAll(LINE_CONTINUATION, ' ').trim(),
        line: getPosition(text, match.index).line,
    }));
}

export const DOCKER_INSTRUCTIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docker/instructions': { check: checkInstructions, explanations: INSTRUCTION_EXPLANATIONS },
};
