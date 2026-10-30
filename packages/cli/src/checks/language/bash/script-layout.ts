import type { Session } from '#cli/types/session.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { listCodeLines } from '#cli/parsers/code/bash.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import type { ScriptFile, LayoutFinding } from '#cli/types/checks/language/bash.ts';
import { MAIN_FUNCTION, BASH_SOURCE_COMMANDS } from '#cli/config/checks/language/bash/scripts.ts';

import {
    RULES,
    MAIN_CALL,
    STRICT_MODE,
    BASH_SHEBANGS,
    OPTION_COMMANDS,
    LIBRARY_DECLARATIONS,
    LIBRARY_FLOW_MESSAGE,
    LIBRARY_MAIN_MESSAGE,
    MAIN_FUNCTION_MESSAGE,
    EXECUTABLE_BIT_MESSAGE,
    LIBRARY_COMMAND_FINDINGS,
} from '#cli/config/checks/language/bash/script-layout.ts';

function validateStrictMode(codeLines: NumberedLine[]): LayoutFinding[] {
    const first = codeLines.findIndex((line) => !OPTION_COMMANDS.some((command) => line.text.startsWith(command)));
    const before = new Set(codeLines.slice(0, first === -1 ? codeLines.length : first).map((line) => line.text));
    return before.has(STRICT_MODE)
        ? []
        : [
              {
                  line: codeLines[0]?.number ?? 1,
                  rule: RULES.strictMode,
                  message: `Put ${STRICT_MODE} before the first command.`,
              },
          ];
}

function validateMainFunction(file: ScriptFile, codeLines: NumberedLine[]): LayoutFinding[] {
    if (file.functions.length === 0) return [];
    const issues: LayoutFinding[] = [];
    if (file.functions.filter((scriptFunction) => scriptFunction.name === MAIN_FUNCTION).length !== 1)
        issues.push({ line: 1, rule: RULES.mainFunction, message: MAIN_FUNCTION_MESSAGE });
    const last = codeLines.at(-1);
    if (last?.text !== MAIN_CALL)
        issues.push({
            line: last?.number ?? 1,
            rule: RULES.mainCall,
            message: `An executable ends with ${MAIN_CALL}.`,
        });
    return issues;
}

function validateLibraryStatement(statement: ScriptFile['statements'][number], file: ScriptFile): LayoutFinding[] {
    if (LIBRARY_DECLARATIONS.has(statement.kind)) return [];
    if (statement.kind === 'command') {
        const command = file.commands.find((call) => call.line === statement.line)?.name;
        if (command !== undefined && BASH_SOURCE_COMMANDS.has(command)) return [];
        const finding = LIBRARY_COMMAND_FINDINGS.get(command ?? '');
        if (finding !== undefined) return [{ line: statement.line, ...finding }];
    }
    return [{ line: statement.line, rule: RULES.libraryFlow, message: LIBRARY_FLOW_MESSAGE }];
}

function validateLibraryScript(file: ScriptFile, codeLines: NumberedLine[]): LayoutFinding[] {
    const last = codeLines.at(-1);
    if (last?.text === MAIN_CALL)
        return [
            {
                line: last.number,
                rule: RULES.executableBit,
                message: EXECUTABLE_BIT_MESSAGE,
            },
        ];
    const issues: LayoutFinding[] = [];
    if (file.functions.some((scriptFunction) => scriptFunction.name === MAIN_FUNCTION))
        issues.push({ line: 1, rule: RULES.libraryMain, message: LIBRARY_MAIN_MESSAGE });
    return [...issues, ...file.statements.flatMap((statement) => validateLibraryStatement(statement, file))];
}

function validateScriptFile(file: ScriptFile): CheckFinding[] {
    const issues: LayoutFinding[] = [];
    if (!BASH_SHEBANGS.has(file.lines[0] ?? ''))
        issues.push({
            line: 1,
            rule: RULES.shebang,
            message: `The first line is not one of ${[...BASH_SHEBANGS].join(' or ')}.`,
        });
    const code = listCodeLines(file.code);
    if (file.executable) issues.push(...validateStrictMode(code), ...validateMainFunction(file, code));
    else issues.push(...validateLibraryScript(file, code));
    for (const temporary of file.temporaryPaths)
        if (temporary.cleanupLines.length === 0)
            issues.push({
                line: temporary.line,
                rule: RULES.mktempTrap,
                message: `The temporary path ${temporary.name} needs a trap that removes it.`,
            });
    return issues.map(({ line, rule, message: text }) => ({
        file: file.path,
        line,
        rule: rule,
        message: text,
    }));
}

/**
Checks the layout of files classified as Bash scripts.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkScriptLayout(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const isEnvironmentReader = buildPathMatcher(planned.scope.settings.tables.structure?.environment_readers ?? []);
    const scripts = await readScripts(session, {
        ...planned,
        files: planned.files.filter((file) => file.tags.includes('bash')),
    });
    return scripts.flatMap((file) =>
        validateScriptFile(file).filter(
            (finding) => finding.rule !== RULES.libraryFlow || !isEnvironmentReader(file.path),
        ),
    );
}
