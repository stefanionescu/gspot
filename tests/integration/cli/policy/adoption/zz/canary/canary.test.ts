import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

test('canary: git in a fresh sandbox reports not a repository', async () => {
    await using sandbox = await testdir();
    const direct = Bun.spawnSync(['git', 'rev-parse', '--is-inside-work-tree'], { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    const cat = Bun.spawnSync(['sh', '-c', 'echo out; echo err 1>&2; exit 3'], { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    console.log('CANARY', JSON.stringify({ code: direct.exitCode, err: direct.stderr.toString(), sh: cat.exitCode, shout: cat.stdout.toString(), sherr: cat.stderr.toString() }));
    expect(direct.stderr.toString()).toStartWith('fatal');
});
