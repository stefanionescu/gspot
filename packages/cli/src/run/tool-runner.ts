// Runs external tools with explicit file lists and configuration, and turns their output into findings.
import { join } from 'node:path';

import { probeTool } from '#cli/doctor/probes.ts';
import { toPlatform } from '#cli/platform/paths.ts';
import { run } from '#cli/platform/spawn.ts';
import type { SpawnResult } from '#cli/platform/spawn.ts';
import type { PlannedCheck } from '#cli/run/plan.ts';
import type { Session } from '#cli/run/session.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import type { CheckSpec, OutputFormat } from '#types/manifest.ts';

export type Substitutions = { files: string[]; scope: string; root: string; messageFile?: string; indent: number };

const DEFAULT_OUTPUT: OutputFormat = {
    format: 'regex',
    pattern: '^(?<file>[^:\\s][^:]*):(?<line>\\d+):(?:(?<column>\\d+):)?\\s*(?<message>.*)$',
};

function configPath(session: Session, planned: PlannedCheck, name: string): string {
    const targets = [
        ...(planned.manifest?.configs ?? []),
        ...[...session.manifests.values()].flatMap((manifest) => manifest.configs),
    ];
    const target = targets.find(
        (config) => !config.fragment && config.target.replace(/^\.gspot\//, '').replace(/\..*$/, '') === name,
    );
    if (!target) throw new Error(`check ${planned.id} names {config:${name}} and no preset renders it.`);
    return target.target;
}

function stubPath(session: Session, planned: PlannedCheck, name: string, scope: string): string {
    const targets = [
        ...(planned.manifest?.configs ?? []),
        ...[...session.manifests.values()].flatMap((manifest) => manifest.configs),
    ];
    const target = targets.find((config) => config.stub?.path === name);
    const path = target?.stub?.path ?? name;
    return scope === '' ? path : `${scope}/${path}`;
}

/** Expands the placeholders of a manifest command into argv. {files} expands to every file, in the platform's form. */
export function substitute(session: Session, planned: PlannedCheck, command: string[], sub: Substitutions): string[] {
    const argv: string[] = [];
    for (const part of command) {
        if (part === '{files}') {
            argv.push(...sub.files.map(toPlatform));
            continue;
        }
        if (part === '{file}') continue;
        const replaced = part
            .replace(/\{config:([a-z0-9-]+)\}/g, (_, name: string) => toPlatform(configPath(session, planned, name)))
            .replace(/\{stub:([^}]+)\}/g, (_, name: string) => toPlatform(stubPath(session, planned, name, sub.scope)))
            .replace('{scope}', sub.scope === '' ? '.' : sub.scope)
            .replace('{root}', sub.root)
            .replace('{indent}', String(sub.indent))
            .replace('{message_file}', sub.messageFile ?? '');
        argv.push(replaced);
    }
    return argv;
}

function parseRegex(check: string, output: OutputFormat, text: string, help: string): Finding[] {
    const pattern = new RegExp(output.pattern ?? DEFAULT_OUTPUT.pattern!);
    const fixable = output.fixable ? new RegExp(output.fixable) : undefined;
    const findings: Finding[] = [];
    for (const line of text.split('\n')) {
        const match = line.match(pattern);
        if (!match?.groups) continue;
        const groups = match.groups;
        const finding: Finding = {
            check,
            file: (groups['file'] ?? '').replace(/^\.\//, ''),
            message: (groups['message'] ?? output.message ?? line).trim(),
            help,
            fixable: fixable ? fixable.test(line) : output.fixable === undefined && output.message !== undefined,
        };
        if (groups['line']) finding.line = Number(groups['line']);
        if (groups['column']) finding.column = Number(groups['column']);
        if (groups['rule']) finding.rule = groups['rule'];
        else {
            const trailing =
                finding.message.match(/\[([A-Za-z0-9_:/@.-]+)\]\s*$/) ??
                finding.message.match(/\(([a-z0-9_:/@.-]+)\)\s*$/);
            if (trailing) {
                finding.rule = trailing[1]!;
                finding.message = finding.message.slice(0, trailing.index).trim();
            }
        }
        findings.push(finding);
    }
    return findings;
}

function parseGrouped(check: string, output: OutputFormat, text: string, help: string): Finding[] {
    const filePattern = new RegExp(output.file_pattern ?? '^(?<file>[^\\s].*):$');
    const pattern = new RegExp(output.pattern ?? '^\\s+(?<line>\\d+): (?<message>.*)$');
    const findings: Finding[] = [];
    let file = '';
    for (const line of text.split('\n')) {
        const header = line.match(filePattern);
        if (header?.groups?.['file'] !== undefined) {
            file = header.groups['file'].replace(/^\.\//, '');
            continue;
        }
        const match = line.match(pattern);
        if (!match?.groups) continue;
        const finding: Finding = {
            check,
            file,
            message: (match.groups['message'] ?? line).trim(),
            help,
            fixable: false,
        };
        if (match.groups['line']) finding.line = Number(match.groups['line']);
        if (match.groups['column']) finding.column = Number(match.groups['column']);
        if (match.groups['rule']) finding.rule = match.groups['rule'];
        findings.push(finding);
    }
    return findings;
}

type EslintMessage = {
    ruleId: string | null;
    line?: number;
    column?: number;
    message: string;
    fix?: unknown;
    severity: number;
};

function parseEslintJson(check: string, text: string, help: string, root: string): Finding[] {
    const start = text.indexOf('[');
    if (start === -1) return [];
    let files: { filePath: string; messages: EslintMessage[] }[];
    try {
        files = JSON.parse(text.slice(start)) as { filePath: string; messages: EslintMessage[] }[];
    } catch {
        return [{ check, file: '', message: text.trim().slice(0, 400), help, fixable: false }];
    }
    const findings: Finding[] = [];
    for (const file of files) {
        const rel = file.filePath.startsWith(root) ? file.filePath.slice(root.length + 1) : file.filePath;
        for (const message of file.messages) {
            const finding: Finding = {
                check,
                file: rel.split('\\').join('/'),
                message: message.message,
                help,
                fixable: message.fix !== undefined,
            };
            if (message.line !== undefined) finding.line = message.line;
            if (message.column !== undefined) finding.column = message.column;
            if (message.ruleId) finding.rule = message.ruleId;
            findings.push(finding);
        }
    }
    return findings;
}

/** Findings from a tool's output, per the check's output format. */
export function parseOutput(spec: CheckSpec, result: SpawnResult, root: string): Finding[] {
    const output = spec.output ?? DEFAULT_OUTPUT;
    const text = `${result.stdout}\n${result.stderr}`;
    switch (output.format) {
        case 'none':
            return [];
        case 'eslint-json':
            return parseEslintJson(spec.id, result.stdout, spec.fix, root);
        case 'lines':
            return text
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => ({ check: spec.id, file: '', message: line, help: spec.fix, fixable: false }));
        case 'regex':
            return parseRegex(spec.id, output, text, spec.fix);
        case 'grouped':
            return parseGrouped(spec.id, output, text, spec.fix);
    }
}

/** Runs one planned tool check. */
export async function runToolCheck(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const { spec, tool, scope } = planned;
    const base: CheckResult = {
        id: spec.id,
        scope: scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
        baselined: 0,
    };
    if (!spec.command || !tool) return { ...base, status: 'error', note: 'this check has no command to run' };
    const probe = probeTool(session.root, tool);
    if (probe.state === 'missing')
        return {
            ...base,
            status: 'missing',
            note: `${tool.name}${tool.version ? ` ${tool.version}` : ''} is not installed. Run: ${probe.hint ?? 'install it'}`,
        };
    if (probe.state === 'outdated')
        return {
            ...base,
            status: 'missing',
            note: `${tool.name} ${probe.found} is below ${probe.floor}. Run: ${probe.hint ?? 'install it'}`,
        };
    const cwd =
        spec.cwd === 'scope' || (spec.takes === 'project' && spec.cwd !== 'root')
            ? join(session.root, scope.scope.path)
            : session.root;
    const relative =
        cwd === session.root
            ? (path: string) => path
            : (path: string) => (scope.scope.path === '' ? path : path.slice(scope.scope.path.length + 1));
    const sub: Substitutions = {
        files: planned.files.map((file) => relative(file.path)),
        scope: scope.scope.path,
        root: session.root,
        indent: scope.view.format.indent_width,
    };
    if (planned.messageFile !== undefined) sub.messageFile = planned.messageFile;
    const argv = substitute(session, planned, spec.command, sub);
    argv[0] = probe.path ?? argv[0]!;
    const perFile = spec.command.includes('{file}');
    const started = performance.now();
    let findings: Finding[] = [];
    let failed = false;
    let broke: string | undefined;
    const runs = perFile
        ? planned.files.map((file) => [
              ...argv.slice(0, spec.command!.indexOf('{file}')),
              toPlatform(relative(file.path)),
              ...argv.slice(spec.command!.indexOf('{file}') + 1),
          ])
        : [argv];
    for (const command of runs) {
        const result = await run(command, { cwd, env: { NO_COLOR: '1', FORCE_COLOR: '0' } });
        if (result.missing)
            return { ...base, status: 'missing', note: `${tool.name} could not be started: ${result.stderr.trim()}` };
        if (spec.tool_errors && new RegExp(spec.tool_errors, 'm').test(`${result.stdout}\n${result.stderr}`)) {
            broke = `${result.stderr.trim() || result.stdout.trim()}`.split('\n')[0];
            break;
        }
        const parsed = parseOutput(spec, result, session.root);
        if (perFile && parsed.length === 0 && result.code !== 0) {
            const file = command[command.length - 1] ?? '';
            parsed.push({
                check: spec.id,
                file: file.split('\\').join('/'),
                message: (result.stderr.trim() || result.stdout.trim() || `${tool.name} exited ${result.code}`).split(
                    '\n',
                )[0]!,
                help: spec.fix,
                fixable: false,
            });
        }
        if (cwd !== session.root && scope.scope.path !== '')
            for (const finding of parsed)
                if (finding.file !== '' && !finding.file.startsWith(`${scope.scope.path}/`))
                    finding.file = `${scope.scope.path}/${finding.file}`;
        findings.push(...parsed);
        if (spec.count_regex) {
            const count = (`${result.stdout}\n${result.stderr}`.match(new RegExp(spec.count_regex, 'g')) ?? []).length;
            if (count > 0) failed = true;
        } else if (result.code !== 0) {
            failed = true;
            if (parsed.length === 0)
                findings.push({
                    check: spec.id,
                    file: '',
                    message: (result.stderr.trim() || result.stdout.trim() || `${tool.name} exited ${result.code}`)
                        .split('\n')
                        .slice(0, 20)
                        .join('\n'),
                    help: spec.fix,
                    fixable: false,
                });
        }
    }
    const duration = performance.now() - started;
    if (broke !== undefined)
        return { ...base, status: 'error', duration, note: `${tool.name} broke: ${broke}`, command: argv };
    if (!failed && !spec.count_regex)
        findings = findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    return { ...base, status: failed || findings.length > 0 ? 'fail' : 'ok', duration, findings, command: argv };
}
