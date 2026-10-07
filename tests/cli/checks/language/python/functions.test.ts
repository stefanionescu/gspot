import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { trivialFunctions as pythonTrivial } from '#cli/checks/language/python/functions.ts';

test('Python counts nested control flow and reports decorated methods and leaves lambda expressions in place', async () => {
    const text =
        'class A:\n    @decorator\n    def method(self):\n        return 1\ndef outer():\n    def inner():\n        one()\n        two()\n        three()\n    return lambda x: x\ndef flow(x):\n    if x:\n        one()\n        two()\n';
    await using sandbox = await testdir({ 'example.py': text });
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['python'], { level: 'all', tables: '[limits.python]\nmin_function_statements = 2\n' }),
    );
    const initial = await pythonTrivial(buildEngineInput(await openSession(sandbox.path), 'python/trivial-functions'));
    expect(initial.filter((entry) => entry.rule === 'trivial-function').map((entry) => entry.line)).toStrictEqual([
        3, 5,
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['python'], { level: 'all', tables: '[limits.python]\nmin_function_statements = 3\n' }),
    );
    const increased = await pythonTrivial(
        buildEngineInput(await openSession(sandbox.path), 'python/trivial-functions'),
    );
    expect(increased.filter((entry) => entry.rule === 'trivial-function').map((entry) => entry.line)).toStrictEqual([
        3, 5, 6, 11,
    ]);
});
