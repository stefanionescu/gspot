import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { getPosition } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { DockerInstruction } from '#cli/types/configurations/infrastructure.ts';
import { WHITESPACE_RUN, DOWNLOAD_COMMANDS, INTERPRETER_COMMANDS } from '#cli/config/parsers.ts';
import { INSTRUCTION_EXPLANATIONS } from '#cli/configurations/infrastructure/docker/explanations.ts';

import {
    NGINX_IMAGE,
    NPM_COMMAND,
    EXEC_FORM_START,
    LOCKED_INSTALLS,
    INSTRUCTION_RULES,
    LINE_CONTINUATION,
    NPM_INSTALL_VERBS,
    DOCKER_INSTRUCTION,
    PATCH_LEVEL_VERSION,
    INSTRUCTION_MESSAGES,
} from '#cli/config/configurations/infrastructure.ts';

function isUnlockedInstall(command: Node): boolean {
    const [verb = '', ...rest] = command.childrenForFieldName('argument').map(({ text }) => text);
    const name = posix.basename(command.childForFieldName('name')?.text ?? '');
    if (name === NPM_COMMAND) return NPM_INSTALL_VERBS.has(verb) && rest.every((word) => word.startsWith('-'));
    const locked = LOCKED_INSTALLS[name];
    return locked?.verbs.includes(verb) === true && rest.every((word) => !locked.flags.includes(word));
}

function isPipedDownload(pipeline: Node): boolean {
    const commands = pipeline.namedChildren
        .filter((node) => node.type === 'command')
        .map(({ text }) => text.split(WHITESPACE_RUN).map((word) => posix.basename(word)));
    const download = commands.findIndex(([name = '']) => DOWNLOAD_COMMANDS.has(name));
    return (
        download !== -1 &&
        commands
            .slice(download + 1)
            .some(([name = '', argument = '']) => INTERPRETER_COMMANDS.has(name) || INTERPRETER_COMMANDS.has(argument))
    );
}

async function listRunHits(session: Session, text: string): Promise<Array<keyof typeof INSTRUCTION_RULES>> {
    using tree = await parseSource('bash', text, session);
    return [
        ...tree.rootNode
            .descendantsOfType('command')
            .flatMap((command) => (isUnlockedInstall(command) ? ['lockfile' as const] : [])),
        ...tree.rootNode
            .descendantsOfType('pipeline')
            .flatMap((pipeline) => (isPipedDownload(pipeline) ? ['pipedDownload' as const] : [])),
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
    return name === 'FROM' && hasFloatingNginxTag(text) ? ['nginxTag'] : [];
}

/**
Reports each Dockerfile instruction that can rewrite a lockfile, pipes a download into a shell, floats an nginx tag, or
wraps the entry point in a shell.

@param session the repository and its tools.
@param planned the Dockerfiles to read.
*/
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

/**
List the instructions of a Dockerfile, each with its continued lines joined.

@param text the Dockerfile.
*/
export function listDockerInstructions(text: string): DockerInstruction[] {
    const instructions: DockerInstruction[] = Array.from(text.matchAll(DOCKER_INSTRUCTION), (match) => ({
        name: (match.groups?.['name'] ?? '').toUpperCase(),
        text: (match.groups?.['text'] ?? '').replaceAll(LINE_CONTINUATION, ' ').trim(),
        line: getPosition(text, match.index).line,
    }));
    return instructions;
}

export const DOCKER_INSTRUCTIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docker/instructions': { check: checkInstructions, explanations: INSTRUCTION_EXPLANATIONS },
};
