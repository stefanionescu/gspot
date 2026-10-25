import { realpathSync } from 'node:fs';
import { sep, posix, isAbsolute } from 'node:path';
import { hasErrorCode } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import type { Finding } from '#cli/types/runs/check.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { parseJsonFindings } from '#cli/runs/output/json.ts';
import { parseKnipFindings } from '#cli/runs/output/knip.ts';
import { parseSarifFindings } from '#cli/runs/output/sarif.ts';
import { parseTyposFindings } from '#cli/runs/output/typos.ts';
import { DRIVE_LETTER } from '#cli/config/files/path-patterns.ts';
import { parseSemgrepFindings } from '#cli/runs/output/semgrep.ts';
import { parseMarkdownlintFindings } from '#cli/runs/output/markdownlint.ts';
import { FILE_GROUP, TAPLO_OUTPUTS, MISSING_PATH_CODES } from '#cli/config/runs/output/formats.ts';
import { parseLineFindings, parseRegexFindings, parseGroupedFindings } from '#cli/runs/output/text.ts';
import type { CheckOutput, OutputPaths, ParsingCheck, OutputParser } from '#cli/types/runs/output/formats.ts';

function readCanonicalPath(path: string): string | undefined {
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
    const canonicalRoot = readCanonicalPath(root);
    const canonicalFile = readCanonicalPath(file);
    if (canonicalRoot === undefined || canonicalFile === undefined) return file;
    return canonicalFile.startsWith(`${canonicalRoot}/`) ? canonicalFile.slice(canonicalRoot.length + 1) : file;
}

function listRootPrefixes(root: string): string[] {
    const roots = [root, readCanonicalPath(root) ?? root];
    const prefixes = new Set(roots.flatMap((form) => [`${form}/`, `${form.replaceAll('/', () => sep)}${sep}`]));
    return [...prefixes].toSorted((first, second) => second.length - first.length);
}

export const outputFormats = {
    none: { parse: () => [], namesFiles: () => false },
    json: {
        parse: parseJsonFindings,
        namesFiles: (output) => output.fields?.file !== undefined,
    },
    sarif: { parse: parseSarifFindings, namesFiles: () => true },
    typos: { parse: parseTyposFindings, namesFiles: () => true },
    taplo: {
        parse: (output) => TAPLO_OUTPUTS.flatMap((format) => parseRegexFindings({ ...output, output: format })),
        namesFiles: () => true,
    },
    markdownlint: { parse: parseMarkdownlintFindings, namesFiles: () => true },
    knip: { parse: parseKnipFindings, namesFiles: () => true },
    semgrep: { parse: parseSemgrepFindings, namesFiles: () => true },
    lines: { parse: parseLineFindings, namesFiles: () => false },
    regex: { parse: parseRegexFindings, namesFiles: (output) => (output.pattern ?? '').includes(FILE_GROUP) },
    grouped: { parse: parseGroupedFindings, namesFiles: (output) => (output.pattern ?? '').includes(FILE_GROUP) },
} satisfies Record<CheckOutput['format'], OutputParser>;

/**
Read the findings in the tool output, with every path relative to the root.

@param check how to read the output.
@param stdout the standard output of the tool.
@param stderr the standard error of the tool.
@param paths the folders that resolve reported files.
@returns the findings.
*/
export function parseOutput(check: ParsingCheck, stdout: string, stderr: string, paths: OutputPaths): Finding[] {
    const { root, cwd } = paths;
    const posixRoot = convertToPosixPath(root);
    const output = check.output;
    const text = stripVTControlCharacters(`${stdout}\n${stderr}`);
    const findings = outputFormats[output.format].parse({
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
        const formatted = { ...finding, message, fixable: check.fix !== undefined && finding.fixable };
        if (check.runs === 'history' || finding.file === '') return formatted;
        const file = convertToPosixPath(finding.file);
        const absolute = isAbsolute(file) || DRIVE_LETTER.test(file) ? file : posix.join(convertToPosixPath(cwd), file);
        formatted.file = stripRoot(posixRoot, absolute);
        return formatted;
    });
}
