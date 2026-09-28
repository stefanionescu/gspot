// Every template of every configuration renders at both levels into a file its reader parses (S-1).
import ts from 'typescript';
import { symlinkSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { configurationManifests } from '#cli/kits/manifests.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import type { Parser } from '#tests/types/integration/cli/generation.ts';
import { PLANTED } from '#tests/config/integration/cli/generation/generation.ts';

const MODULES = fileURLToPath(new URL('../../../../node_modules', import.meta.url));
const PARSERS: Record<string, Parser> = {
    '.json': parseJson,
    '.jsonc': parseJson,
    '.webmanifest': parseJson,
    '.toml': (text) => {
        parseToml(text);
    },
    '.yml': (text) => void parseYaml(text),
    '.yaml': (text) => void parseYaml(text),
    '.mjs': parseModule,
    '.cjs': parseModule,
    '.js': parseModule,
    '.ts': parseModule,
};

function parseJson(text: string, path: string): void {
    const errors: ParseError[] = [];
    parseJsonc(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error(`${path}: JSON error at offset ${String(errors[0]!.offset)}`);
}

function parseModule(text: string, path: string): void {
    const result = ts.transpileModule(text, { reportDiagnostics: true, fileName: path });
    const errors = (result.diagnostics ?? []).map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );
    if (errors.length > 0) throw new Error(`${path}: ${errors.join('; ')}`);
}

const kits = [...configurationManifests().values()]
    .filter((manifest) => manifest.configs.some((config) => !config.fragment))
    .map((manifest) => manifest.kit.name);

test.each(kits.flatMap((name) => ['recommended', 'all'].map((level) => [name, level] as const)))(
    'the %s configuration renders files their readers parse at level %s',
    async (name, level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...PLANTED,
            'gspot.toml': `version = 1\nlevel = "${level}"\nkits = [${JSON.stringify(name)}]\n`,
        });
        symlinkSync(MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const session = await openSession(sandbox.path);
        const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        });
        const generated = output.files.filter((file) => file.kind === 'config' || file.kind === 'pointer');
        expect(generated.length).toBeGreaterThan(0);
        for (const file of generated) {
            const parser = PARSERS[extname(file.path)];
            if (parser !== undefined) parser(file.content, file.path);
        }
    },
);
