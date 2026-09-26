// Every template of every configuration renders at both levels into a file its reader parses (S-1).
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { expect, test } from 'bun:test';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

const MODULES = fileURLToPath(new URL('../../../../node_modules', import.meta.url));
const PLANTED = {
    'package.json': '{"name":"planted","private":true,"type":"module"}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'pyproject.toml': '[project]\nname = "planted"\nversion = "1.0.0"\n',
    'src/index.ts': 'export const answer = 42;\n',
};

type Parser = (text: string, path: string) => void;

const PARSERS: Record<string, Parser> = {
    '.json': parseJson,
    '.jsonc': parseJson,
    '.webmanifest': parseJson,
    '.toml': (text) => void parseToml(text),
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

function extensionOf(path: string): string {
    const base = path.slice(path.lastIndexOf('/') + 1);
    return base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
}

const configurations = [...configurationManifests().values()]
    .filter((manifest) => manifest.configs.some((config) => !config.fragment))
    .map((manifest) => manifest.configuration.name);

test.each(configurations.flatMap((name) => ['recommended', 'all'].map((level) => [name, level] as const)))(
    'the %s configuration renders files their readers parse at level %s',
    async (name, level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...PLANTED,
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = [${JSON.stringify(name)}]\n`,
        });
        symlinkSync(MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const session = await openSession(sandbox.path);
        const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        });
        const generated = output.files.filter((file) => file.kind === 'config' || file.kind === 'pointer');
        expect(generated.length).toBeGreaterThan(0);
        for (const file of generated) {
            const parser = PARSERS[extensionOf(file.path)];
            if (parser !== undefined) parser(file.content, file.path);
        }
    },
);
