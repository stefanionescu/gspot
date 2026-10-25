import { join, resolve } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { runGit, readGitText, runGitBlocking, runGitForBytes } from '#cli/system/git.ts';

const [timeoutSeconds = '', reportPath = ''] = process.argv.slice(2);
const root = process.cwd();
const nested = join(root, 'nested');
const gitDirOutput = await readGitText(root, ['rev-parse', '--absolute-git-dir'], {});
const gitDir = gitDirOutput.replace(/\n$/u, '');
const index = resolve(root, readEnvironmentVariable('GIT_INDEX_FILE') ?? '');
const head = readFileSync(join(gitDir, 'HEAD'));
const indexed = readFileSync(index);
const headOutput = await readGitText(root, ['rev-parse', 'HEAD'], {});
const hash = headOutput.trim();
const reports = [];
for (const source of [{ kind: 'index' as const }, { kind: 'commit' as const, hash }]) {
    using copy = await copyRevision(nested, source);
    const folderOutput = await readGitText(copy.root, ['rev-parse', '--absolute-git-dir'], {});
    const folder = folderOutput.trim();
    const treeOutput = await readGitText(copy.root, ['write-tree'], {});
    const bytes = await runGitForBytes(copy.root, ['ls-files', '-z'], {});
    const tool = await runTool(['git', 'rev-parse', '--absolute-git-dir'], {
        cwd: copy.root,
        timeoutSeconds: Number(timeoutSeconds),
    });
    const configured = runGitBlocking(copy.root, ['config', '--get', 'gspot.boundary'], {});
    const intentional = runGitBlocking(copy.root, ['config', '--get', 'gspot.explicit'], {
        env: { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'gspot.explicit', GIT_CONFIG_VALUE_0: 'caller' },
    });
    const controller = new AbortController();
    controller.abort(new Error('Hook cancellation'));
    const cancelled = await runGit(copy.root, ['rev-parse', 'HEAD'], { cancelSignal: controller.signal });
    reports.push({
        kind: source.kind,
        source: readFileSync(join(copy.root, 'source.txt'), 'utf8'),
        tree: copy.tree === treeOutput.trim(),
        ownMetadata: folder !== gitDir,
        toolMetadata: tool.stdout.trim() === folder,
        paths: Buffer.from(bytes.stdout).toString('utf8').split('\0').filter(Boolean),
        configuration: configured.stdout.trim(),
        explicit: intentional.stdout.trim(),
        cancelled: cancelled.canceled && cancelled.code !== 0,
    });
}
writeFileSync(
    reportPath,
    JSON.stringify({
        reports,
        headRetained: readFileSync(join(gitDir, 'HEAD')).equals(head),
        indexRetained: readFileSync(index).equals(indexed),
        workingBytes: readFileSync(join(nested, 'source.txt'), 'utf8'),
    }),
);
