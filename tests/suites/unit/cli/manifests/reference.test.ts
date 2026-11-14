import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { buildConfiguration } from '#tests/setup/cli/manifests.ts';
import { formatDetectionConditions } from '#cli/manifests/reference.ts';
import { SHEBANG_TAG, DETECTION_LABELS } from '#cli/config/manifests.ts';
import { SWIFT_TEST_TAG, SWIFT_IMPORT_TAG, SWIFT_TEST_TARGET_TAG } from '#cli/config/parsers/code.ts';

test('detection tags read as a shebang, a Swift test file, a test target, and an import', () => {
    const tags = [SWIFT_TEST_TAG, SWIFT_TEST_TARGET_TAG, `${SWIFT_IMPORT_TAG}SwiftUI`, `${SHEBANG_TAG}bash`];
    const { detect } = buildConfiguration('example', { tables: stringify({ detect: { tags } }) });
    expect(formatDetectionConditions(detect).conditions).toStrictEqual([
        `${DETECTION_LABELS.tags[0]} \`bash\``,
        'a Swift test file',
        'a `Package.swift` with a test target',
        'a Swift file that imports `SwiftUI`',
    ]);
});
