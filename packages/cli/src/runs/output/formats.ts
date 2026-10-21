// Defines tool-output formats and reads findings from tool output.
import { realpathSync } from 'node:fs';
import { sep, posix, isAbsolute } from 'node:path';
import { hasErrorCode } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import type { Finding } from '#cli/types/runs/check.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { DRIVE_LETTER } from '#cli/config/system/paths.ts';
import { parseJsonFindings } from '#cli/runs/output/json.ts';
import { parseKnipFindings } from '#cli/runs/output/knip.ts';
import { parseSarifFindings } from '#cli/runs/output/sarif.ts';
import { parseTyposFindings } from '#cli/runs/output/typos.ts';
import { parseSemgrepFindings } from '#cli/runs/output/semgrep.ts';
import { FILE_GROUP, MISSING_PATH_CODES } from '#cli/config/runs/output.ts';
import { parseMarkdownlintFindings } from '#cli/runs/output/markdownlint.ts';
import { parseLineFindings, parseRegexFindings, parseGroupedFindings } from '#cli/runs/output/text.ts';
import type { CheckOutput, OutputPaths, ParsingCheck, OutputDescriptor } from '#cli/types/runs/output.ts';

/**
 * Resolve a path the way tools print it after they follow links.
 *
 * @param path the file or folder.
 * @returns the resolved path with POSIX separators, or undefined when nothing exists at the path.
 */
function readRealPath(path: string): string | undefined {
    try {
        // The call gives Windows paths one drive letter case and their long folder names.
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
    const realRoot = readRealPath(root);
    const realFile = readRealPath(file);
    if (realRoot === undefined || realFile === undefined) return file;
    return realFile.startsWith(`${realRoot}/`) ? realFile.slice(realRoot.length + 1) : file;
}

/**
 * List the forms of the root that a tool can print in a message.
 * The longest form comes first, so that a shorter form never cuts a longer one.
 *
 * @param root the repository folder with POSIX separators.
 * @returns the root and its resolved form in POSIX and in system separators.
 */
function listRootPrefixes(root: string): string[] {
    const roots = [root, readRealPath(root) ?? root];
    const prefixes = new Set(roots.flatMap((form) => [`${form}/`, `${form.replaceAll('/', sep)}${sep}`]));
    return [...prefixes].toSorted((first, second) => second.length - first.length);
}

function hasFilePaths(output: CheckOutput): boolean {
    return (output.pattern ?? '').includes(FILE_GROUP);
}

/** The reader and process-result rules for every supported output format. */
export const outputFormats = {
    none: { parse: () => [], namesFiles: () => false },
    json: {
        parse: parseJsonFindings,
        namesFiles: (output) => output.fields?.file !== undefined,
    },
    sarif: { parse: parseSarifFindings, namesFiles: () => true },
    typos: { parse: parseTyposFindings, namesFiles: () => true },
    markdownlint: { parse: parseMarkdownlintFindings, namesFiles: () => true },
    knip: { parse: parseKnipFindings, namesFiles: () => true },
    semgrep: { parse: parseSemgrepFindings, namesFiles: () => true },
    lines: { parse: parseLineFindings, namesFiles: () => false },
    regex: { parse: parseRegexFindings, namesFiles: hasFilePaths },
    grouped: { parse: parseGroupedFindings, namesFiles: hasFilePaths },
} satisfies Record<CheckOutput['format'], OutputDescriptor>;

/**
 * Read the findings in the tool output, with every path relative to the root.
 *
 * @param check how to read the output.
 * @param stdout the standard output of the tool.
 * @param stderr the standard error of the tool.
 * @param paths the folders that resolve reported files.
 * @returns the findings.
 */
export function parseOutput(check: ParsingCheck, stdout: string, stderr: string, paths: OutputPaths): Finding[] {
    const { root, cwd } = paths;
    const rootPath = convertToPosixPath(root);
    const output = check.output;
    // A tool that colors its output although nothing reads colors still yields clean paths and messages.
    const text = stripVTControlCharacters(`${stdout}\n${stderr}`);
    const findings = outputFormats[output.format].parse({
        check: check.name,
        help: check.help,
        output,
        stdout,
        text,
        root,
        cwd,
    });
    const prefixes = listRootPrefixes(rootPath);
    return findings.map((finding) => {
        let message = finding.message;
        for (const prefix of prefixes) message = message.replaceAll(prefix, '');
        const formatted = { ...finding, message, fixable: check.fix !== undefined && finding.fixable };
        if (check.runs === 'history' || finding.file === '') return formatted;
        const file = convertToPosixPath(finding.file);
        const absolute = isAbsolute(file) || DRIVE_LETTER.test(file) ? file : posix.join(convertToPosixPath(cwd), file);
        formatted.file = stripRoot(rootPath, absolute);
        return formatted;
    });
}
