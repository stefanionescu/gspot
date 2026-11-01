import { noVueMixins } from './rules/no-vue-mixins.ts';
import { noTestRetries } from './rules/no-test-retries.ts';
import { testHooksFirst } from './rules/test-hooks-first.ts';
import { noGeneratedKeys } from './rules/no-generated-keys.ts';
import { preferTestTable } from './rules/prefer-test-table.ts';
import { noCodeAfterDone } from './rules/no-code-after-done.ts';
import { noEmptyTestFile } from './rules/no-empty-test-file.ts';
import { noExclusiveTests } from './rules/no-exclusive-tests.ts';
import { noEmptyTestTable } from './rules/no-empty-test-table.ts';
import { noFixedTestWaits } from './rules/no-fixed-test-waits.ts';
import { preferNativeAxios } from './rules/prefer-native-axios.ts';
import { requireMemoizeKey } from './rules/require-memoize-key.ts';
import { noEarlyTestReturn } from './rules/no-early-test-return.ts';
import { noEmptyTestTitles } from './rules/no-empty-test-titles.ts';
import { noForcedUiActions } from './rules/no-forced-ui-actions.ts';
import { noLeakedJsxNumber } from './rules/no-leaked-jsx-number.ts';
import { noSelfStateUpdate } from './rules/no-self-state-update.ts';
import { noUiTestDebugging } from './rules/no-ui-test-debugging.ts';
import { preferNativeJquery } from './rules/prefer-native-jquery.ts';
import { preferNativeLodash } from './rules/prefer-native-lodash.ts';
import { requireErrorChecks } from './rules/require-error-checks.ts';
import { noNestedVitestMock } from './rules/no-nested-vitest-mock.ts';
import { noVueUpdatedWrites } from './rules/no-vue-updated-writes.ts';
import { noComponentDebounce } from './rules/no-component-debounce.ts';
import { preferReadonlyProps } from './rules/prefer-readonly-props.ts';
import { noDuplicateTestRows } from './rules/no-duplicate-test-rows.ts';
import { noSetterInComponent } from './rules/no-setter-in-component.ts';
import { noConstantAssertions } from './rules/no-constant-assertions.ts';
import { noInvertedAssertions } from './rules/no-inverted-assertions.ts';
import { validThrowAssertions } from './rules/valid-throw-assertions.ts';
import { noVueClassComponents } from './rules/no-vue-class-components.ts';
import { noInlineInterpolation } from './rules/no-inline-interpolation.ts';
import { noMisplacedAssertions } from './rules/no-misplaced-assertions.ts';
import { requireTestAssertions } from './rules/require-test-assertions.ts';
import { testingLibraryQueries } from './rules/testing-library-queries.ts';
import { noAsyncSuiteCallbacks } from './rules/no-async-suite-callbacks.ts';
import { noDuplicateTestTitles } from './rules/no-duplicate-test-titles.ts';
import { noIncompleteAssertions } from './rules/no-incomplete-assertions.ts';
import { noUnexplainedTestSkips } from './rules/no-unexplained-test-skips.ts';
import { preferMatcherAssertions } from './rules/prefer-matcher-assertions.ts';
import { noCypressThenAssertions } from './rules/no-cypress-then-assertions.ts';
import { noDefaultUtilityImports } from './rules/no-default-utility-imports.ts';
import { noOverflowingTestTimeout } from './rules/no-overflowing-test-timeout.ts';
import { noSelfComparingAssertions } from './rules/no-self-comparing-assertions.ts';
import { noUncertainChaiAssertions } from './rules/no-uncertain-chai-assertions.ts';
import { noMismatchedAssertionTypes } from './rules/no-mismatched-assertion-types.ts';

export const testRules = {
    'no-exclusive-tests': noExclusiveTests,
    'no-unexplained-test-skips': noUnexplainedTestSkips,
    'no-early-test-return': noEarlyTestReturn,
    'no-empty-test-titles': noEmptyTestTitles,
    'no-duplicate-test-titles': noDuplicateTestTitles,
    'test-hooks-first': testHooksFirst,
    'no-async-suite-callbacks': noAsyncSuiteCallbacks,
    'no-code-after-done': noCodeAfterDone,
    'no-overflowing-test-timeout': noOverflowingTestTimeout,
    'no-test-retries': noTestRetries,
    'no-inline-interpolation': noInlineInterpolation,
    'no-nested-vitest-mock': noNestedVitestMock,
    'no-empty-test-table': noEmptyTestTable,
    'no-duplicate-test-rows': noDuplicateTestRows,
    'prefer-test-table': preferTestTable,
    'no-empty-test-file': noEmptyTestFile,
    'no-incomplete-assertions': noIncompleteAssertions,
    'no-inverted-assertions': noInvertedAssertions,
    'no-self-comparing-assertions': noSelfComparingAssertions,
    'require-error-checks': requireErrorChecks,
    'no-uncertain-chai-assertions': noUncertainChaiAssertions,
    'no-ui-test-debugging': noUiTestDebugging,
    'no-forced-ui-actions': noForcedUiActions,
    'testing-library-queries': testingLibraryQueries,
    'no-fixed-test-waits': noFixedTestWaits,
    'no-constant-assertions': noConstantAssertions,
    'prefer-matcher-assertions': preferMatcherAssertions,
    'no-mismatched-assertion-types': noMismatchedAssertionTypes,
    'valid-throw-assertions': validThrowAssertions,
    'require-test-assertions': requireTestAssertions,
    'no-misplaced-assertions': noMisplacedAssertions,
    'no-cypress-then-assertions': noCypressThenAssertions,
};

export const frameworkRules = {
    'no-setter-in-component': noSetterInComponent,
    'no-self-state-update': noSelfStateUpdate,
    'no-generated-keys': noGeneratedKeys,
    'no-leaked-jsx-number': noLeakedJsxNumber,
    'no-vue-class-components': noVueClassComponents,
    'no-vue-mixins': noVueMixins,
    'no-default-utility-imports': noDefaultUtilityImports,
    'require-memoize-key': requireMemoizeKey,
    'prefer-native-jquery': preferNativeJquery,
    'prefer-native-axios': preferNativeAxios,
    'no-component-debounce': noComponentDebounce,
    'prefer-readonly-props': preferReadonlyProps,
    'no-vue-updated-writes': noVueUpdatedWrites,
    'prefer-native-lodash': preferNativeLodash,
};
