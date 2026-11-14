import { sep, posix, isAbsolute } from 'node:path';
import { DRIVE_LETTER } from '#cli/config/system.ts';
import { stripVTControlCharacters } from 'node:util';
import { escapeRegExp } from '#cli/system/patterns.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import type { CheckOutput } from '#cli/types/manifests.ts';
import { COPIES_FOLDER } from '#cli/config/repository/git.ts';
import { parseJsonFindings } from '#cli/engine/outputs/json.ts';
import { parseKnipFindings } from '#cli/engine/outputs/knip.ts';
import { parseValeFindings } from '#cli/engine/outputs/vale.ts';
import { parseTyposFindings } from '#cli/engine/outputs/typos.ts';
import { parseSemgrepFindings } from '#cli/engine/outputs/semgrep.ts';
import { parseOsvScannerFindings } from '#cli/engine/outputs/osv-scanner.ts';
import { findCanonicalPath, convertToPosixPath } from '#cli/system/paths.ts';
import { parseRegexFindings, parseGroupedFindings } from '#cli/engine/outputs/text.ts';
import type { OutputPaths, OutputParser, ParsingCheck } from '#cli/types/engine/tool-runs.ts';
import { FILE_GROUP, RULE_GROUP, TAPLO_OUTPUTS, MISSING_RULE_HELP, MISSING_RULE_MESSAGE } from '#cli/config/engine.ts';

const COPY_ROOT = new RegExp(`^(?<repository>.*)/${escapeRegExp(COPIES_FOLDER)}/[^/]+(?<folder>/.*)?$`, 'u');

/**
List the forms of a folder path. A copy lists the folder of the repository too, because a tool that follows a link to an
installed package reports the path in the repository.
*/
function listRootForms(root: string): string[] {
    const forms = [root, findCanonicalPath(root) ?? root];
    const copied = COPY_ROOT.exec(root)?.groups;
    return copied === undefined ? forms : [...forms, `${copied['repository'] ?? ''}${copied['folder'] ?? ''}`];
}

function stripRoot(root: string, file: string): string {
    const prefix = `${root}/`;
    if (file.startsWith(prefix)) return file.slice(prefix.length);
    if (!isAbsolute(file)) return file;
    const canonicalFile = findCanonicalPath(file) ?? file;
    const form = listRootForms(root).find((each) => canonicalFile.startsWith(`${each}/`));
    return form === undefined ? posix.relative(root, canonicalFile) : canonicalFile.slice(form.length + 1);
}

export function buildRootRelativePath(path: string, cwd: string, posixRoot: string): string {
    const file = convertToPosixPath(path);
    const absolute = isAbsolute(file) || DRIVE_LETTER.test(file) ? file : posix.join(convertToPosixPath(cwd), file);
    return stripRoot(posixRoot, absolute);
}

export function listRootPrefixes(root: string): string[] {
    const prefixes = new Set(
        listRootForms(root).flatMap((form) => {
            const native = form.replaceAll('/', () => sep);
            return [`${form}/`, `${native}${sep}`, `${native}/`];
        }),
    );
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
    'osv-scanner': { parse: parseOsvScannerFindings, namesFiles: () => true, namesRules: () => true },
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

export function parseOutput(check: ParsingCheck, stdout: string, stderr: string, paths: OutputPaths): Finding[] {
    const { root, cwd } = paths;
    const posixRoot = convertToPosixPath(root);
    const output = check.output;
    const text = stripVTControlCharacters(`${stdout}\n${stderr}`);
    const findings = OUTPUT_FORMATS[output.format].parse({
        check: check.id,
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
            ...(MISSING_RULE_MESSAGE.test(message) && { help: MISSING_RULE_HELP }),
        };
        if (check.runs === 'history' || finding.file === '') return formatted;
        formatted.file = buildRootRelativePath(finding.file, cwd, posixRoot);
        return formatted;
    });
}
