import { Command, CommanderError } from 'commander';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://github.com/alex-pinkus/tree-sitter-swift.git';
const REVISION = 'b8b22bffbb3441780e6471665bacfb263741c86a';
const VERSION = '0.7.3';
const TREE_SITTER = '0.25.10';
const EMSCRIPTEN = 'emscripten/emsdk@sha256:90b757eb11fa9a0e3ce4d2d9f76d932a56018e4accc37b5a28b2783751e60eb7';
const here = dirname(fileURLToPath(import.meta.url));

function execute(command: string[], cwd: string, environment = process.env): string {
    const result = Bun.spawnSync(command, { cwd, env: environment, stdout: 'pipe', stderr: 'pipe', timeout: 180_000 });
    if (result.exitCode !== 0)
        throw new Error(`${command[0]} failed: ${result.stderr.toString()}${result.stdout.toString()}`);
    return result.stdout.toString().trim();
}

function build(out: string, check: boolean): void {
    if (!execute(['tree-sitter', '--version'], here).startsWith(`tree-sitter ${TREE_SITTER} `))
        throw new Error(`Install tree-sitter ${TREE_SITTER} before building the Swift grammar.`);
    const work = realpathSync(mkdtempSync(join(tmpdir(), 'gspot-swift-')));
    try {
        const source = join(work, 'source');
        execute(['git', 'init', '--quiet', source], work);
        execute(['git', '-C', source, 'fetch', '--quiet', '--depth', '1', SOURCE, REVISION], work);
        execute(['git', '-C', source, 'checkout', '--quiet', '--detach', 'FETCH_HEAD'], work);
        if (execute(['git', '-C', source, 'rev-parse', 'HEAD'], work) !== REVISION)
            throw new Error('The Swift grammar revision does not match.');
        execute(['tree-sitter', 'generate'], source);
        const tools = join(work, 'tools');
        mkdirSync(tools);
        // Keep tree-sitter's compiler arguments while pinning its compiler container by digest.
        writeFileSync(
            join(tools, 'emcc'),
            `#!/usr/bin/env bun\nconst result = Bun.spawnSync(['docker', 'run', '--rm', '--platform', 'linux/amd64', '--network', 'none', '--mount', ${JSON.stringify(`type=bind,source=${work},target=${work}`)}, '--workdir', process.cwd(), ${JSON.stringify(EMSCRIPTEN)}, 'emcc', ...process.argv.slice(2)], {stdin:'inherit',stdout:'inherit',stderr:'inherit'});\nprocess.exit(result.exitCode);\n`,
            { mode: 0o755 },
        );
        const binary = join(work, 'swift.wasm');
        execute(['tree-sitter', 'build', '--wasm', '--output', binary], source, {
            ...process.env,
            PATH: `${tools}${delimiter}${process.env['PATH'] ?? ''}`,
        });
        const bytes = readFileSync(binary);
        if (!WebAssembly.validate(bytes)) throw new Error('The Swift grammar is not valid WebAssembly.');
        const provenance = `${JSON.stringify({ source: SOURCE, revision: REVISION, version: VERSION, treeSitter: TREE_SITTER, emscripten: EMSCRIPTEN, sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex') }, null, 4)}\n`;
        writeFileSync(join(work, 'swift.json'), provenance);
        copyFileSync(join(source, 'LICENSE'), join(work, 'swift.LICENSE'));
        const files = ['swift.wasm', 'swift.json', 'swift.LICENSE'];
        if (check) {
            for (const file of files)
                if (!readFileSync(join(out, file)).equals(readFileSync(join(work, file))))
                    throw new Error(`Regenerate ${file} with bun packages/cli/scripts/build-swift-grammar.ts.`);
        } else {
            mkdirSync(out, { recursive: true });
            for (const file of files) {
                const temporary = join(out, `.${file}.${process.pid}.tmp`);
                try {
                    copyFileSync(join(work, file), temporary);
                    renameSync(temporary, join(out, file));
                } finally {
                    rmSync(temporary, { force: true });
                }
            }
        }
        console.log(`Swift ${VERSION} grammar ${check ? 'matches' : 'built'}: ${JSON.parse(provenance).sha256}`);
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}

try {
    const program = new Command('bun packages/cli/scripts/build-swift-grammar.ts')
        .description('Build the pinned Swift grammar with tree-sitter and an isolated Emscripten container')
        .option('--out <directory>', 'Output directory', join(here, '../grammars'))
        .option('--check', 'Compare the reproducible output without writing repository files')
        .allowExcessArguments(false)
        .exitOverride()
        .parse();
    const options = program.opts<{ out: string; check?: boolean }>();
    build(resolve(options.out), options.check === true);
} catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    process.exitCode = error.exitCode === 0 ? 0 : 2;
}
