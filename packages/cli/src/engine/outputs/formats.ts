import { realpathSync } from 'node:fs';
import { isAbsolute, posix, sep } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import {
    FILE_GROUP,
    MISSING_PATH_CODES,
    MISSING_RULE_HELP,
    MISSING_RULE_MESSAGE,
    RULE_GROUP,
    TAPLO_OUTPUTS,
} from '#cli/config/engine.ts';
import { DRIVE_LETTER } from '#cli/config/system.ts';
import { parseJsonFindings } from '#cli/engine/outputs/json.ts';
import { parseKnipFindings } from '#cli/engine/outputs/knip.ts';
import { parseSemgrepFindings } from '#cli/engine/outputs/semgrep.ts';
import { parseGroupedFindings, parseRegexFindings } from '#cli/engine/outputs/text.ts';
import { parseTyposFindings } from '#cli/engine/outputs/typos.ts';
import { parseValeFindings } from '#cli/engine/outputs/vale.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { CheckOutput, Finding, OutputParser, OutputPaths, ParsingCheck } from '#cli/types/engine/tool-runs.ts';

function findCanonicalPath(path: string): string | undefined {
    try {
        return convertToPosixPath(realpathSync.native(path));
    } catch (error) {
        if ([...MISSING_PATH_CODES].some((code) => hasErrorCode(error, code))) return undefined;
        throw error;
    }
}

function stripRoot(root: string, file: string): string {
    const prefix = `${root}/`;
    if (file.startsWith(prefix)) return file.slice(prefix.length);
    if (!isAbsolute(file)) return file;
    const canonicalRoot = findCanonicalPath(root);
    const canonicalFile = findCanonicalPath(file);
    if (canonicalRoot === undefined || canonicalFile === undefined) return file;
    return canonicalFile.startsWith(`${canonicalRoot}/`) ? canonicalFile.slice(canonicalRoot.length + 1) : file;
}

function listRootPrefixes(root: string): string[] {
    const roots = [root, findCanonicalPath(root) ?? root];
    const prefixes = new Set(roots.flatMap((form) => [`${form}/`, `${form.replaceAll('/', () => sep)}${sep}`]));
    return [...prefixes].toSorted((first, second) => second.length - first.length);
}

export const OUTPUT_FORMATS = {
    none: { parse: () => [], namesFiles: () => false, namesRules: () => false },
    json: {
        parse: parseJsonFindings,
        namesFiles: (output) => output.fields?.file !== undefined,
        namesRules: (output) => output.fields?.rule !== undefined,
    },
    typos: { parse: parseTyposFindings, namesFiles: () => true, namesRules: () => false },
    taplo: {
        parse: (output) => TAPLO_OUTPUTS.flatMap((format) => parseRegexFindings({ ...output, output: format })),
        namesFiles: () => true,
        namesRules: () => false,
    },
    knip: { parse: parseKnipFindings, namesFiles: () => true, namesRules: () => true },
    semgrep: { parse: parseSemgrepFindings, namesFiles: () => true, namesRules: () => true },
    vale: { parse: parseValeFindings, namesFiles: () => true, namesRules: () => true },
    regex: {
        parse: parseRegexFindings,
        namesFiles: (output) => (output.pattern ?? '').includes(FILE_GROUP),
        namesRules: (output) => (output.pattern ?? '').includes(RULE_GROUP),
    },
    grouped: {
        parse: parseGroupedFindings,
        namesFiles: (output) => (output.file_pattern ?? '').includes(FILE_GROUP),
        namesRules: (output) => (output.pattern ?? '').includes(RULE_GROUP),
    },
} satisfies Record<CheckOutput['format'], OutputParser>;

function buildRootRelativePath(path: string, cwd: string, posixRoot: string): string {
    const file = convertToPosixPath(path);
    const absolute = isAbsolute(file) || DRIVE_LETTER.test(file) ? file : posix.join(convertToPosixPath(cwd), file);
    return stripRoot(posixRoot, absolute);
}

/**
Read the findings in the tool output, with every path relative to the root.

@param check how to read the output.
@param stdout the standard output of the tool.
@param stderr the standard error of the tool.
@param paths the folders that resolve reported files.
*/
export function parseOutput(check: ParsingCheck, stdout: string, stderr: string, paths: OutputPaths): Finding[] {
    const { root, cwd } = paths;
    const posixRoot = convertToPosixPath(root);
    const output = check.output;
    const text = stripVTControlCharacters(`${stdout}\n${stderr}`);
    const findings = OUTPUT_FORMATS[output.format].parse({
        check: check.id,
        help: check.help,
        output,
        stdout,
        text,
        root,
        cwd,
    });
    const prefixes = listRootPrefixes(posixRoot);
    return findings.map((finding) => {
        let message = finding.message;
        for (const prefix of prefixes) message = message.replaceAll(prefix, '');
        const formatted = {
            ...finding,
            message,
            fixable: check.fix !== undefined && finding.fixable,
            ...(MISSING_RULE_MESSAGE.test(message) && { help: MISSING_RULE_HELP, explain: '' }),
        };
        if (check.runs === 'history' || finding.file === '') return formatted;
        formatted.file = buildRootRelativePath(finding.file, cwd, posixRoot);
        return formatted;
    });
}
