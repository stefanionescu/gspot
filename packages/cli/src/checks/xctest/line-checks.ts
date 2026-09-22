import type { EngineInput } from '#cli/run/types.ts';
// The test checks that read one line at a time: a disabled test says why, no test sleeps, and no snapshot test records.
import type { Finding } from '#cli/output/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { xcodeFinding } from '#cli/checks/xcode/files.ts';
import { testFiles } from '#cli/checks/xctest/test-files.ts';

const DISABLED = /\bXCTSkip(?:If|Unless)?\(|\.disabled\(|@available\(\*, unavailable/u;
// A string literal of eight characters or more on the line: the reason a skip or a disabled trait carries.
const REASONED = /"[^"]{8,}"/u;
const COMMENT = /^\s*\/\/\s*\S{3,}/u;
const SLEEP = /\b(?:sleep|usleep)\(|\bThread\.sleep\b|\bTask\.sleep\b/u;
const RECORDING = /\bisRecording\s*=\s*true\b|\brecord:\s*(?:true|\.all|\.missing|\.failed)\b/u;

function hasReason(lines: string[], index: number): boolean {
    return REASONED.test(lines[index] ?? '') || COMMENT.test(lines[index - 1] ?? '');
}

function lineFindings(
    input: EngineInput,
    pattern: RegExp,
    rule: string,
    text: string,
    isFine: (lines: string[], index: number) => boolean,
): Finding[] {
    return testFiles(input).flatMap((file) =>
        file.lines.flatMap((line, index): Finding[] => {
            if (!pattern.test(line) || /^\s*\/\//u.test(line) || isFine(file.lines, index)) return [];
            return [xcodeFinding(input, { file: file.path, line: index + 1 }, rule, text)];
        }),
    );
}

/**
 * One finding for each disabled or skipped test that gives no reason on its line or the line above.
 * @param input the engine input
 * @returns the findings
 */
export function disabledTests(input: EngineInput): Promise<Finding[]> {
    const said = 'This test is turned off and says no reason, on this line or in a comment above it.';
    return Promise.resolve(lineFindings(input, DISABLED, 'disabled', said, hasReason));
}

/**
 * One finding for each sleep in a test file outside tools.xctest.sleep_allowed.
 * @param input the engine input
 * @returns the findings
 */
export function noSleep(input: EngineInput): Promise<Finding[]> {
    const allowed = (input.view.tool('xctest')['sleep_allowed'] as { paths: string[] }[] | undefined) ?? [];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const said = 'A test that sleeps is slow when it passes and flaky when it fails; wait on an expectation.';
    const found = lineFindings(input, SLEEP, 'sleep', said, () => false);
    return Promise.resolve(found.filter((finding) => !isAllowed(finding.file)));
}

/**
 * One finding for each snapshot test left in a recording mode.
 * @param input the engine input
 * @returns the findings
 */
export function recordingMode(input: EngineInput): Promise<Finding[]> {
    const said = 'Recording mode is on, so this test writes a new reference and passes whatever the screen shows.';
    return Promise.resolve(lineFindings(input, RECORDING, 'recording', said, () => false));
}
