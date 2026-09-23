import { chmodSync, mkdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
/** The files and policy needed to plant a defect for one check. */
export type PlantedInput = {
    check: string;
    files: Record<string, string>;
    policy?: string;
    policyEdit?: [string, string];
    removed?: string[];
    executable?: string[];
};

function originalFile(path: string): { bytes: Uint8Array; mode: number } | undefined {
    try {
        const mode = statSync(path).mode;
        return { bytes: readFileSync(path), mode };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

function isAbsent(path: string): boolean {
    try {
        statSync(path);
        return false;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
        throw error;
    }
}

function absentParents(cwd: string, paths: string[]): string[] {
    const parents = new Set<string>();
    for (const path of paths) {
        let parent = dirname(join(cwd, path));
        while (parent !== cwd && isAbsent(parent)) {
            parents.add(parent);
            parent = dirname(parent);
        }
    }
    return [...parents].toSorted((a, b) => b.length - a.length);
}

function restoreFiles(cwd: string, originals: Map<string, { bytes: Uint8Array; mode: number } | undefined>): void {
    for (const [path, original] of originals) {
        const full = join(cwd, path);
        if (original === undefined) rmSync(full, { force: true });
        else {
            writeFileSync(full, original.bytes);
            chmodSync(full, original.mode);
        }
    }
}

function removeParents(parents: string[]): void {
    for (const path of parents) {
        try {
            rmdirSync(path);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
}

function plantFiles(cwd: string, planted: PlantedInput, policy: string): void {
    const { removed = [], executable = [] } = planted;
    for (const path of removed) rmSync(join(cwd, path));
    for (const [path, text] of Object.entries(planted.files)) {
        const full = join(cwd, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, text);
    }
    for (const path of executable) chmodSync(join(cwd, path), statSync(join(cwd, path)).mode | 0o111);
    writeFileSync(join(cwd, 'gspot.toml'), policy);
}

// Preserve bytes and permissions before the first mutation, including setup that fails partway through.
export function plant(cwd: string, planted: PlantedInput): () => void {
    const policyPath = join(cwd, 'gspot.toml');
    const policy = plantedPolicy(readFileSync(policyPath, 'utf8'), planted);
    const gone = planted.removed ?? [];
    const executables = planted.executable ?? [];
    const paths = [...new Set(['gspot.toml', ...gone, ...executables, ...Object.keys(planted.files)])];
    const originals = new Map(paths.map((path) => [path, originalFile(join(cwd, path))]));
    for (const path of gone)
        if (originals.get(path) === undefined) throw new Error(`The sandbox removal target ${path} is absent.`);
    const parents = absentParents(cwd, paths);
    const restore = (): void => {
        restoreFiles(cwd, originals);
        removeParents(parents);
    };
    try {
        plantFiles(cwd, planted, policy);
    } catch (error) {
        restore();
        throw error;
    }
    return restore;
}

function plantedPolicy(policy: string, planted: PlantedInput): string {
    const edited = planted.policyEdit === undefined ? policy : policy.replace(...planted.policyEdit);
    if (edited === policy && planted.policyEdit !== undefined)
        throw new Error(`The policy edit for ${planted.check} did not change the sandbox.`);
    return planted.policy === undefined ? edited : `${edited}\n${planted.policy}`;
}
