import { TextDecoder } from 'node:util';
import { sep, relative } from 'node:path';
import { codePoints } from '#cli/platform/text.ts';
import { readSource } from '#cli/platform/source.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toPosix, isInside } from '#cli/platform/paths.ts';
import type { SourceLocationFile } from '#cli/types/checks/general/security.ts';
import type { SarifRun, SarifPlace, SarifArtifactLocation, SarifPhysicalLocation } from '#cli/types/parsers/sarif.ts';

function indexedArtifact(artifact: SarifArtifactLocation, run: SarifRun): SarifArtifactLocation {
    if (artifact === undefined) return undefined;
    if (artifact.uri !== undefined || artifact.index === undefined) return artifact;
    const resolved = run.artifacts?.[artifact.index]?.location;
    if (resolved?.uri === undefined) throw new Error('CodeQL reported a missing artifact location.');
    return resolved;
}

// Source URIs must resolve inside the selected copy before path-specific exceptions can apply.
function sourceFile(artifact: SarifArtifactLocation, run: SarifRun, source: string): string {
    if (artifact?.uri === undefined) return '';
    const root = pathToFileURL(`${source}${sep}`);
    const baseOf = (id: string, seen = new Set<string>()): URL => {
        if (seen.has(id)) throw new Error('CodeQL reported a cyclic source location.');
        seen.add(id);
        const base = run.originalUriBaseIds?.[id];
        if (base === undefined) {
            if (id === '%SRCROOT%') return root;
            throw new Error(`CodeQL reported an unknown source location: ${id}.`);
        }
        return new URL(base.uri ?? '', base.uriBaseId === undefined ? root : baseOf(base.uriBaseId, seen));
    };
    const uri = new URL(artifact.uri, artifact.uriBaseId === undefined ? root : baseOf(artifact.uriBaseId));
    if (uri.protocol !== 'file:') throw new Error('CodeQL reported a source location that is not a file.');
    const file = relative(source, fileURLToPath(uri));
    if (!isInside(file)) throw new Error('CodeQL reported a source location outside its selected source copy.');
    return toPosix(file);
}

function sourceText(run: SarifRun, index: number | undefined, source: SourceLocationFile): string {
    if (source.file === '') throw new Error('CodeQL reported a character offset without a source file.');
    const encoding =
        (index === undefined ? undefined : run.artifacts?.[index]?.encoding) ?? run.defaultEncoding ?? 'utf8';
    return new TextDecoder(encoding, { fatal: true }).decode(readSource(source.root, source.file));
}

// Decode offsets as code points, then report columns in the unit declared by the producer.
function offsetPosition(text: string, offset: number, run: SarifRun): Required<Omit<SarifPlace, 'file'>> {
    const characters = codePoints(text);
    if (offset > characters.length) throw new Error('CodeQL reported a character offset beyond the source file.');
    const prefix = characters.slice(0, offset).join('');
    const breaks = run.newlineSequences ?? ['\r\n', '\n'];
    let line = 1;
    let start = 0;
    for (let cursor = 0; cursor < prefix.length; ) {
        const newline = breaks.find((sequence) => prefix.startsWith(sequence, cursor));
        if (newline === undefined) cursor += 1;
        else {
            cursor += newline.length;
            line += 1;
            start = cursor;
        }
    }
    const tail = prefix.slice(start);
    return {
        line,
        column: (run.columnKind === 'unicodeCodePoints' ? codePoints(tail).length : tail.length) + 1,
    };
}

/**
 * Resolve a validated SARIF physical location into a source path and coordinates.
 * @param location the first result location, when present
 * @param run its source metadata
 * @param source the selected source copy
 * @returns the repository-relative location
 */
export function placeOf(location: SarifPhysicalLocation, run: SarifRun, source: string): SarifPlace {
    if (location === undefined) return { file: '', line: 1 };
    const { artifactLocation: reference = {}, region } = location;
    const artifact = indexedArtifact(reference, run);
    const file = sourceFile(artifact, run, source);
    if (region.charOffset >= 0 && region.startLine === undefined) {
        const text = sourceText(run, reference.index, { root: source, file });
        return { file, ...offsetPosition(text, region.charOffset, run) };
    }
    return {
        file,
        line: region.startLine ?? 1,
        ...(region.startColumn === undefined ? {} : { column: region.startColumn }),
    };
}
