import { noVueMixins } from './rules/vue/no-vue-mixins.ts';
import { noTestRetries } from './rules/testing/no-test-retries.ts';
import { noGeneratedKeys } from './rules/react/no-generated-keys.ts';
import { testHooksFirst } from './rules/testing/test-hooks-first.ts';
import { preferTestTable } from './rules/testing/prefer-test-table.ts';
import { noCodeAfterDone } from './rules/testing/no-code-after-done.ts';
import { noEmptyTestFile } from './rules/testing/no-empty-test-file.ts';
import { noExclusiveTests } from './rules/testing/no-exclusive-tests.ts';
import { noLeakedJsxNumber } from './rules/react/no-leaked-jsx-number.ts';
import { noSelfStateUpdate } from './rules/react/no-self-state-update.ts';
import { noEmptyTestTable } from './rules/testing/no-empty-test-table.ts';
import { noFixedTestWaits } from './rules/testing/no-fixed-test-waits.ts';
import { noVueUpdatedWrites } from './rules/vue/no-vue-updated-writes.ts';
import { noEarlyTestReturn } from './rules/testing/no-early-test-return.ts';
import { noEmptyTestTitles } from './rules/testing/no-empty-test-titles.ts';
import { noForcedUiActions } from './rules/testing/no-forced-ui-actions.ts';
import { noUiTestDebugging } from './rules/testing/no-ui-test-debugging.ts';
import { preferNativeAxios } from './rules/libraries/prefer-native-axios.ts';
import { requireMemoizeKey } from './rules/libraries/require-memoize-key.ts';
import { noComponentDebounce } from './rules/react/no-component-debounce.ts';
import { preferReadonlyProps } from './rules/react/prefer-readonly-props.ts';
import { noSetterInComponent } from './rules/react/no-setter-in-component.ts';
import { noNestedVitestMock } from './rules/testing/no-nested-vitest-mock.ts';
import { noVueClassComponents } from './rules/vue/no-vue-class-components.ts';
import { preferNativeJquery } from './rules/libraries/prefer-native-jquery.ts';
import { preferNativeLodash } from './rules/libraries/prefer-native-lodash.ts';
import { requireErrorChecks } from './rules/assertions/require-error-checks.ts';
import { noDuplicateTestRows } from './rules/testing/no-duplicate-test-rows.ts';
import { noInlineInterpolation } from './rules/testing/no-inline-interpolation.ts';
import { testingLibraryQueries } from './rules/testing/testing-library-queries.ts';
import { noConstantAssertions } from './rules/assertions/no-constant-assertions.ts';
import { noInvertedAssertions } from './rules/assertions/no-inverted-assertions.ts';
import { validThrowAssertions } from './rules/assertions/valid-throw-assertions.ts';
import { noAsyncSuiteCallbacks } from './rules/testing/no-async-suite-callbacks.ts';
import { noDuplicateTestTitles } from './rules/testing/no-duplicate-test-titles.ts';
import { noMisplacedAssertions } from './rules/assertions/no-misplaced-assertions.ts';
import { requireTestAssertions } from './rules/assertions/require-test-assertions.ts';
import { noUnexplainedTestSkips } from './rules/testing/no-unexplained-test-skips.ts';
import { noIncompleteAssertions } from './rules/assertions/no-incomplete-assertions.ts';
import { preferMatcherAssertions } from './rules/assertions/prefer-matcher-assertions.ts';
import { noDefaultUtilityImports } from './rules/libraries/no-default-utility-imports.ts';
import { noOverflowingTestTimeout } from './rules/testing/no-overflowing-test-timeout.ts';
import { noCypressThenAssertions } from './rules/assertions/no-cypress-then-assertions.ts';
import { noSelfComparingAssertions } from './rules/assertions/no-self-comparing-assertions.ts';
import { noUncertainChaiAssertions } from './rules/assertions/no-uncertain-chai-assertions.ts';
import { noMismatchedAssertionTypes } from './rules/assertions/no-mismatched-assertion-types.ts';

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
