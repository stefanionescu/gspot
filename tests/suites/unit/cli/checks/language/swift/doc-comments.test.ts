import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('doc-comments reports each public or open declaration whose doc comment leaves a parameter out', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
        'Sources/App/Mover.swift': `import Foundation

/// Moves a point.
///
/// - Parameter point: Where to go.
@MainActor
public func move(to point: Int, speed: Int) -> Int { point + speed }

public struct Box {
    /// Makes a box.
    /// - Parameters:
    ///   - width: The width.
    ///   - height: The height.
    public init(width: Int, height: Int) {}

    /// Builds a box.
    open class func build(_ value: Int) {}

    public override func describe(_ value: Int) {}

    func hidden(value: Int) {}

    /**
     Scales a box.

     - Parameter factor: How much to scale.
     */
    public func scale(by factor: Int) {}

    public init(side: Int) {}
}
`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'swift/doc-comments');
    expect(findings.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
        {
            line: 6,
            rule: 'missing-parameter',
            message:
                'The doc comment of move does not document `speed`. Add a `- Parameter <name>:` line for each one, or a `- Parameters:` list.',
        },
        {
            line: 17,
            rule: 'missing-parameter',
            message:
                'The doc comment of build does not document `value`. Add a `- Parameter <name>:` line for each one, or a `- Parameters:` list.',
        },
        {
            line: 30,
            rule: 'missing-parameter',
            message:
                'The doc comment of init does not document `side`. Add a `- Parameter <name>:` line for each one, or a `- Parameters:` list.',
        },
    ]);
});
