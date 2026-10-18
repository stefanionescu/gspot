// Defines tool-output formats and reads findings from tool output.
import { realpathSync } from 'node:fs';
import { sep, posix, isAbsolute } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import type { Finding } from '#cli/types/runs/check.ts';
import { DRIVE_LETTER } from '#cli/config/system/paths.ts';
import { parseJsonFindings } from '#cli/runs/output/json.ts';
import { parseKnipFindings } from '#cli/runs/output/knip.ts';
import { parseSarifFindings } from '#cli/runs/output/sarif.ts';
import { parseTyposFindings } from '#cli/runs/output/typos.ts';
import { parseSemgrepFindings } from '#cli/runs/output/semgrep.ts';
import { parseTrufflehogFindings } from '#cli/runs/output/trufflehog.ts';
import { FILE_GROUP, MISSING_PATH_CODES } from '#cli/config/runs/output.ts';
import { parseMarkdownlintFindings } from '#cli/runs/output/markdownlint.ts';
import { convertToPosixPath, normalizeOutputPath } from '#cli/system/paths.ts';
import { parseRegexFindings, parseGroupedFindings } from '#cli/runs/output/text.ts';
import type { OutputSpec, OutputPaths, ParsingCheck, OutputDescriptor } from '#cli/types/runs/output.ts';

/**
 * Resolve a path the way tools print it after they follow links.
 * @param path the file or folder.
 * @returns the resolved path with POSIX separators, or undefined when nothing exists at the path.
 */
function readRealPath(path: string): string | undefined {
    try {
        // The call gives Windows paths one drive letter case and their long folder names.
        return convertToPosixPath(realpathSync.native(path));
    } catch (error) {
        if (MISSING_PATH_CODES.has((error as NodeJS.ErrnoException).code ?? '')) return undefined;
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
 * @param root the repository folder with POSIX separators.
 * @returns the root and its resolved form in POSIX and in system separators.
 */
function listRootPrefixes(root: string): string[] {
    const roots = [root, readRealPath(root) ?? root];
    const prefixes = new Set(roots.flatMap((form) => [`${form}/`, `${form.replaceAll('/', sep)}${sep}`]));
    return [...prefixes].toSorted((first, second) => second.length - first.length);
}

function hasFilePaths(output: OutputSpec): boolean {
    return (
        output.file_type === 'path' &&
        (output.pattern === undefined ? output.fields?.file !== undefined : output.pattern.includes(FILE_GROUP))
    );
}

/** The reader and process-result rules for every supported output format. */
export const outputFormats = {
    none: { read: () => [], namesFiles: () => false, redactsOutput: false },
    json: {
        read: parseJsonFindings,
        namesFiles: (output) => output.file_type === 'path' && output.fields?.file !== undefined,
        redactsOutput: false,
    },
    sarif: { read: parseSarifFindings, namesFiles: () => true, redactsOutput: false },
    trufflehog: { read: parseTrufflehogFindings, namesFiles: () => false, redactsOutput: true },
    typos: { read: parseTyposFindings, namesFiles: () => true, redactsOutput: false },
    markdownlint: { read: parseMarkdownlintFindings, namesFiles: () => true, redactsOutput: false },
    knip: { read: parseKnipFindings, namesFiles: () => true, redactsOutput: false },
    semgrep: { read: parseSemgrepFindings, namesFiles: () => true, redactsOutput: false },
    lines: {
        read: ({ check, text, help }) =>
            text
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line !== '')
                .map((line) => ({ check, file: '', message: line, help, fixable: false })),
        namesFiles: () => false,
        redactsOutput: false,
    },
    regex: { read: parseRegexFindings, namesFiles: hasFilePaths, redactsOutput: false },
    grouped: { read: parseGroupedFindings, namesFiles: hasFilePaths, redactsOutput: false },
} satisfies Record<OutputSpec['format'], OutputDescriptor>;

/**
 * Read the findings in the tool output, with every path relative to the root.
 * @param check how to read the output.
 * @param stdout the standard output of the tool.
 * @param stderr the standard error of the tool.
 * @param paths the folders that resolve reported files.
 * @returns the findings.
 */
export function parseOutput(check: ParsingCheck, stdout: string, stderr: string, paths: OutputPaths): Finding[] {
    const { root, cwd } = paths;
    const rootPath = isAbsolute(root) ? convertToPosixPath(root) : normalizeOutputPath(root);
    const output = check.output;
    // A tool that colors its output although nothing reads colors still yields clean paths and messages.
    const text = stripVTControlCharacters(`${stdout}\n${stderr}`);
    const findings = outputFormats[output.format].read({
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
        if (output.file_type !== 'path' || finding.file === '') return formatted;
        const file = normalizeOutputPath(finding.file);
        const absolute =
            isAbsolute(file) || DRIVE_LETTER.test(file) ? file : posix.join(normalizeOutputPath(cwd), file);
        formatted.file = stripRoot(rootPath, absolute);
        return formatted;
    });
}
