import { noElementOverwrite } from '../rules/collections/no-element-overwrite.ts';
import { noEmptyCollection } from '../rules/collections/no-empty-collection.ts';
import { noImpossibleCollectionSize } from '../rules/collections/no-impossible-collection-size.ts';
import { noInMisuse } from '../rules/collections/no-in-misuse.ts';
import { noMisleadingArrayReverse } from '../rules/collections/no-misleading-array-reverse.ts';
import { noPositiveIndexCheck } from '../rules/collections/no-positive-index-check.ts';
import { noUnusedCollection } from '../rules/collections/no-unused-collection.ts';
import { noVoidArrayCallback } from '../rules/collections/no-void-array-callback.ts';
import { requireReduceInitialValue } from '../rules/collections/require-reduce-initial-value.ts';
import { maxSwitchCases } from '../rules/control-flow/max-switch-cases.ts';
import { noAdjacentMultilineIf } from '../rules/control-flow/no-adjacent-multiline-if.ts';
import { noCompoundCase } from '../rules/control-flow/no-compound-case.ts';
import { noDuplicatedBranches } from '../rules/control-flow/no-duplicated-branches.ts';
import { noEqualLoopCondition } from '../rules/control-flow/no-equal-loop-condition.ts';
import { noIgnoredCatch } from '../rules/control-flow/no-ignored-catch.ts';
import { noMisplacedLoopCounter } from '../rules/control-flow/no-misplaced-loop-counter.ts';
import { noNestedSwitch } from '../rules/control-flow/no-nested-switch.ts';
import { noSmallSwitch } from '../rules/control-flow/no-small-switch.ts';
import { noSwitchCaseLabels } from '../rules/control-flow/no-switch-case-labels.ts';
import { noUnenclosedMultilineBlock } from '../rules/control-flow/no-unenclosed-multiline-block.ts';
import { noUnthrownError } from '../rules/control-flow/no-unthrown-error.ts';
import { noUpdatedLoopCounter } from '../rules/control-flow/no-updated-loop-counter.ts';
import { noDetachedCall } from '../rules/functions/no-detached-call.ts';
import { noEmptyReturnValue } from '../rules/functions/no-empty-return-value.ts';
import { noExcessCallArguments } from '../rules/functions/no-excess-call-arguments.ts';
import { noIdenticalFunctions } from '../rules/functions/no-identical-functions.ts';
import { noIgnoredReturn } from '../rules/functions/no-ignored-return.ts';
import { noInconsistentFunctionCall } from '../rules/functions/no-inconsistent-function-call.ts';
import { noInvariantReturns } from '../rules/functions/no-invariant-returns.ts';
import { noMixedReturnTypes } from '../rules/functions/no-mixed-return-types.ts';
import { noNestedFunctions } from '../rules/functions/no-nested-functions.ts';
import { noSelectorParameter } from '../rules/functions/no-selector-parameter.ts';
import { noSwappedArguments } from '../rules/functions/no-swapped-arguments.ts';
import { noTrivialFunctions } from '../rules/functions/no-trivial-functions.ts';
import { noUndefinedArgument } from '../rules/functions/no-undefined-argument.ts';
import { preferBooleanReturn } from '../rules/functions/prefer-boolean-return.ts';
import { noBitwiseInCondition } from '../rules/logic/no-bitwise-in-condition.ts';
import { noFloatingPointEquality } from '../rules/logic/no-floating-point-equality.ts';
import { noGratuitousExpressions } from '../rules/logic/no-gratuitous-expressions.ts';
import { noIdenticalOperands } from '../rules/logic/no-identical-operands.ts';
import { noNegatedComparison } from '../rules/logic/no-negated-comparison.ts';
import { noRedundantBoolean } from '../rules/logic/no-redundant-boolean.ts';
import { noAsyncConstructor } from '../rules/promises/no-async-constructor.ts';
import { noTryPromise } from '../rules/promises/no-try-promise.ts';
import { preferPromiseShorthand } from '../rules/promises/prefer-promise-shorthand.ts';
import { maxRegexComplexity } from '../rules/regex/max-regex-complexity.ts';
import { noAmbiguousAnchors } from '../rules/regex/no-ambiguous-anchors.ts';
import { noEmptyRepetition } from '../rules/regex/no-empty-repetition.ts';
import { noLazyBeforeOptional } from '../rules/regex/no-lazy-before-optional.ts';
import { noStatefulRegex } from '../rules/regex/no-stateful-regex.ts';
import { noStringRegexPattern } from '../rules/regex/no-string-regex-pattern.ts';
import { noUnknownRegexGroup } from '../rules/regex/no-unknown-regex-group.ts';
import { importBoundaries } from '../rules/structure/import-boundaries.ts';
import { noCommentedCode } from '../rules/structure/no-commented-code.ts';
import { noCommentsInImports } from '../rules/structure/no-comments-in-imports.ts';
import { noIndexImports } from '../rules/structure/no-index-imports.ts';
import { noNestedTemplateLiterals } from '../rules/structure/no-nested-template-literals.ts';
import { noRenamedExports } from '../rules/structure/no-renamed-exports.ts';
import { noTrivialFiles } from '../rules/structure/no-trivial-files.ts';
import { restrictedSyntax } from '../rules/structure/restricted-syntax.ts';
import { noDuplicateInComposite } from '../rules/types/no-duplicate-in-composite.ts';
import { noRedundantOptional } from '../rules/types/no-redundant-optional.ts';
import { noUselessIntersection } from '../rules/types/no-useless-intersection.ts';
import { preferReadonlyStatic } from '../rules/types/prefer-readonly-static.ts';
import { preferTypeAlias } from '../rules/types/prefer-type-alias.ts';
import { preferTypeGuard } from '../rules/types/prefer-type-guard.ts';
import { redundantTypeAliases } from '../rules/types/redundant-type-aliases.ts';
import { noDiscardedPostfix } from '../rules/variables/no-discarded-postfix.ts';
import { noGlobalThis } from '../rules/variables/no-global-this.ts';
import { noGlobalsShadowing } from '../rules/variables/no-globals-shadowing.ts';
import { noKeywordDeclarations } from '../rules/variables/no-keyword-declarations.ts';
import { noMagicNumbers } from '../rules/variables/no-magic-numbers.ts';
import { noRedundantAssignment } from '../rules/variables/no-redundant-assignment.ts';
import { noTransposedAssignment } from '../rules/variables/no-transposed-assignment.ts';
import { preferImmediateReturn } from '../rules/variables/prefer-immediate-return.ts';
import { preferObjectLiteral } from '../rules/variables/prefer-object-literal.ts';

/**
The rules about the language itself. Each key names the folder of `rules/` that holds its rules.
*/
export const LANGUAGE_TOPICS = {
    collections: [
        noElementOverwrite,
        noEmptyCollection,
        noImpossibleCollectionSize,
        noInMisuse,
        noMisleadingArrayReverse,
        noPositiveIndexCheck,
        noUnusedCollection,
        noVoidArrayCallback,
        requireReduceInitialValue,
    ],
    'control-flow': [
        maxSwitchCases,
        noAdjacentMultilineIf,
        noCompoundCase,
        noDuplicatedBranches,
        noEqualLoopCondition,
        noIgnoredCatch,
        noMisplacedLoopCounter,
        noNestedSwitch,
        noSmallSwitch,
        noSwitchCaseLabels,
        noUnenclosedMultilineBlock,
        noUnthrownError,
        noUpdatedLoopCounter,
    ],
    functions: [
        noDetachedCall,
        noEmptyReturnValue,
        noExcessCallArguments,
        noIdenticalFunctions,
        noIgnoredReturn,
        noInconsistentFunctionCall,
        noInvariantReturns,
        noMixedReturnTypes,
        noNestedFunctions,
        noSelectorParameter,
        noSwappedArguments,
        noTrivialFunctions,
        noUndefinedArgument,
        preferBooleanReturn,
    ],
    logic: [
        noBitwiseInCondition,
        noFloatingPointEquality,
        noGratuitousExpressions,
        noIdenticalOperands,
        noNegatedComparison,
        noRedundantBoolean,
    ],
    promises: [noAsyncConstructor, noTryPromise, preferPromiseShorthand],
    regex: [
        maxRegexComplexity,
        noAmbiguousAnchors,
        noEmptyRepetition,
        noLazyBeforeOptional,
        noStatefulRegex,
        noStringRegexPattern,
        noUnknownRegexGroup,
    ],
    structure: [
        importBoundaries,
        noCommentedCode,
        noCommentsInImports,
        noIndexImports,
        noNestedTemplateLiterals,
        noRenamedExports,
        noTrivialFiles,
        restrictedSyntax,
    ],
    types: [
        noDuplicateInComposite,
        noRedundantOptional,
        noUselessIntersection,
        preferReadonlyStatic,
        preferTypeAlias,
        preferTypeGuard,
        redundantTypeAliases,
    ],
    variables: [
        noDiscardedPostfix,
        noGlobalThis,
        noGlobalsShadowing,
        noKeywordDeclarations,
        noMagicNumbers,
        noRedundantAssignment,
        noTransposedAssignment,
        preferImmediateReturn,
        preferObjectLiteral,
    ],
};
