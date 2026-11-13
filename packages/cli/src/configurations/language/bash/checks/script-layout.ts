import {
    BASH_SHEBANGS,
    EXECUTABLE_BIT_MESSAGE,
    LIBRARY_COMMAND_FINDINGS,
    LIBRARY_DECLARATIONS,
    LIBRARY_FLOW_MESSAGE,
    LIBRARY_MAIN_MESSAGE,
    MAIN_CALL,
    MAIN_FUNCTION,
    MAIN_FUNCTION_MESSAGE,
    OPTION_COMMANDS,
    SCRIPT_LAYOUT_RULES,
    STRICT_MODE,
} from '#cli/config/configurations/bash.ts';
import { BASH_SOURCE_COMMANDS } from '#cli/config/configurations/shared.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';
import { SCRIPT_LAYOUT_EXPLANATIONS } from '#cli/configurations/language/bash/explanations.ts';
import { listCodeLines } from '#cli/parsers/code/bash/script.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { formatNameList } from '#cli/system/text/messages.ts';
import type { LayoutFinding, ScriptFile } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { NumberedLine } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

function validateStrictMode(codeLines: NumberedLine[]): LayoutFinding[] {
    const first = codeLines.findIndex((line) => OPTION_COMMANDS.every((command) => !line.text.startsWith(command)));
    const before = new Set(codeLines.slice(0, first === -1 ? codeLines.length : first).map((line) => line.text));
    return before.has(STRICT_MODE)
        ? []
        : [
              {
                  line: codeLines[0]?.number ?? 1,
                  rule: SCRIPT_LAYOUT_RULES.strictMode,
                  message: `Put ${STRICT_MODE} before the first command.`,
              },
          ];
}

function validateMainFunction(file: ScriptFile, codeLines: NumberedLine[]): LayoutFinding[] {
    if (file.functions.length === 0) return [];
    const issues: LayoutFinding[] = [];
    if (file.functions.filter((scriptFunction) => scriptFunction.name === MAIN_FUNCTION).length !== 1)
        issues.push({ line: 1, rule: SCRIPT_LAYOUT_RULES.mainFunction, message: MAIN_FUNCTION_MESSAGE });
    const last = codeLines.at(-1);
    if (last?.text !== MAIN_CALL)
        issues.push({
            line: last?.number ?? 1,
            rule: SCRIPT_LAYOUT_RULES.mainCall,
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
    return [{ line: statement.line, rule: SCRIPT_LAYOUT_RULES.libraryFlow, message: LIBRARY_FLOW_MESSAGE }];
}

function validateLibraryScript(file: ScriptFile, codeLines: NumberedLine[]): LayoutFinding[] {
    const last = codeLines.at(-1);
    if (last?.text === MAIN_CALL)
        return [
            {
                line: last.number,
                rule: SCRIPT_LAYOUT_RULES.executableBit,
                message: EXECUTABLE_BIT_MESSAGE,
            },
        ];
    const issues: LayoutFinding[] = [];
    if (file.functions.some((scriptFunction) => scriptFunction.name === MAIN_FUNCTION))
        issues.push({ line: 1, rule: SCRIPT_LAYOUT_RULES.libraryMain, message: LIBRARY_MAIN_MESSAGE });
    return [...issues, ...file.statements.flatMap((statement) => validateLibraryStatement(statement, file))];
}

function validateScriptFile(file: ScriptFile): CheckFinding[] {
    const issues: LayoutFinding[] = [];
    if (!BASH_SHEBANGS.has(file.lines[0] ?? ''))
        issues.push({
            line: 1,
            rule: SCRIPT_LAYOUT_RULES.shebang,
            message: `The first line is not one of ${formatNameList([...BASH_SHEBANGS], 'disjunction')}.`,
        });
    const code = listCodeLines(file.code);
    if (file.executable) issues.push(...validateStrictMode(code), ...validateMainFunction(file, code));
    else issues.push(...validateLibraryScript(file, code));
    for (const temporary of file.temporaryPaths)
        if (temporary.cleanupLines.length === 0)
            issues.push({
                line: temporary.line,
                rule: SCRIPT_LAYOUT_RULES.mktempTrap,
                message: `The temporary path ${temporary.name} needs a trap that removes it.`,
            });
    return issues.map(({ line, rule, message: text }) => ({
        file: file.path,
        line,
        rule,
        message: text,
    }));
}

async function checkScriptLayout(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const isEnvironmentReader = buildPathMatcher(planned.scope.settings.tables.structure?.environment_readers ?? []);
    const scripts = await readScripts(session, {
        ...planned,
        files: planned.files.filter((file) => file.tags.includes('bash')),
    });
    return scripts.flatMap((file) =>
        validateScriptFile(file).filter(
            (finding) => finding.rule !== SCRIPT_LAYOUT_RULES.libraryFlow || !isEnvironmentReader(file.path),
        ),
    );
}

export const BASH_SCRIPT_LAYOUT_CHECKS: Readonly<Record<string, CheckCode>> = {
    'bash/script-layout': { check: checkScriptLayout, explanations: SCRIPT_LAYOUT_EXPLANATIONS },
};
