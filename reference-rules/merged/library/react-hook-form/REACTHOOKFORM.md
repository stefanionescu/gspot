---
layer: library
preset: react-hook-form
title: React Hook Form
---

# React Hook Form

## Check versions and integrations

Check the installed React Hook Form, React, TypeScript, validation resolver, and UI component `enforced-by: typescript/eslint no-restricted-syntax`
versions before using an API. Keep the application's existing form library and submission transport
unless the task requires a change. Install through the project's package manager.

- Keep `@hookform/resolvers` compatible with the installed Zod release, including Zod 4.5. Use the
  official `zodResolver` adapter rather than rebuilding its nested-error mapping. `enforced-by: typescript/eslint no-restricted-syntax`
- Treat v7 and v8 beta documentation as separate contracts. Do not copy a beta signature into a v7
  application or infer availability from a documentation menu. `enforced-by: typescript/eslint no-restricted-syntax`
- Check version support for newer options. The supplied v7 documentation introduces
  `createFormControl` in 7.55, `useForm.validate` in 7.72, field-array `disabled` in 7.79, and
  `fields[].disabled` in 7.80. Verify the installed behavior before depending on them. `enforced-by: typescript/eslint no-restricted-syntax`
- Check `exact` subscription semantics during upgrades. The v7.81 documentation includes updates
  made to an ancestor path while excluding updates made to a nested child path when `exact` is true. `enforced-by: typescript/eslint no-restricted-syntax`
- `keyName` is a v7 compatibility option scheduled for removal in the next major version. Keep
  persisted identifiers independent of the generated field-array key. `enforced-by: typescript/eslint no-restricted-syntax`
- Verify newer helpers such as `setValues`, `resetDefaultValues`, `useLens`, and `OpaqueTypes`
  against installed exports and types before adopting them. Use them for a concrete need. `enforced-by: typescript/eslint no-restricted-syntax`

See the official [useForm](https://react-hook-form.com/docs/useform),
[useFieldArray](https://react-hook-form.com/docs/usefieldarray), and
[resolver integration](https://github.com/react-hook-form/resolvers) references.

## Own the form instance

Create one form instance for each independently editable form. Keep `useForm`, its event handlers,
and context consumers within a Client Component boundary in the Next.js App Router. Server
Components may load authorized initial data and pass a serializable input model to that boundary.

- Keep mutable form controls scoped to their mounted form. Do not create request-specific
  `createFormControl` instances as module singletons on a Next.js server. `enforced-by: typescript/eslint no-restricted-syntax`
- Give server rendering and the first client render the same defaults. Do not derive initial field
  values from browser storage, a random value, or a browser-only clock during rendering. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep the query cache responsible for server snapshots and React Hook Form responsible for the
  editable draft. Do not mirror every keystroke into Zustand, query data, and local React state. `enforced-by: typescript/eslint no-restricted-syntax`
- Define whether navigating to a different record resets the form or creates a new form instance. A
  reused route or layout can preserve a Client Component; a new record ID alone does not reset
  cached defaults. `enforced-by: typescript/eslint no-restricted-syntax`
- Do not recreate the form to clear an ordinary validation error. Use the relevant error or reset
  API and preserve the user's work. `enforced-by: typescript/eslint no-restricted-syntax`

## Initialize and reconcile values

Provide complete `defaultValues` for the editable input model. They establish the baseline used by `enforced-by: typescript/eslint no-restricted-syntax`
`isDirty` and `dirtyFields`. React Hook Form caches defaults; receiving new props does not by itself
replace that baseline.

- Use field-appropriate empty values, such as an empty string, empty array, or an explicitly allowed
  `null`. Avoid `undefined` defaults for controlled fields and avoid prototype-rich objects as
  defaults unless the chosen control and equality behavior support them. `enforced-by: typescript/eslint no-restricted-syntax`
- Use async `defaultValues` for initial loading when that matches the data owner. Surface
  `formState.isLoading`, loading failures, and retry behavior. Avoid fetching the same initial
  snapshot independently through both the form and TanStack Query. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `values` only when external changes update the form reactively. It can overwrite
  current edits and defaults. Choose `resetOptions` deliberately before connecting it to query
  results that can refetch in the background. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `reset(nextValues)` when accepting a new editing baseline, including a confirmed save or a
  deliberate record change. Do not reset before form subscriptions have initialized. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `keepDirtyValues` when a refresh updates untouched fields while preserving edits, and
  subscribe to `dirtyFields`. `keepDirty` preserves dirty-state flags; it does not preserve edited
  values. `keepDefaultValues` preserves the original comparison baseline. `enforced-by: typescript/eslint no-restricted-syntax`
- Do not carry dirty values from one record into another through a broad reset-preservation option.
  Define the unsaved-change and conflict policy for that transition. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `resetField` for a registered field when only that field's value or baseline resets.
  Supply a valid default value if changing its baseline. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep the `errors` object passed into `useForm` reference-stable. Rebuilding it on every render can
  cause repeated updates. `enforced-by: typescript/eslint no-restricted-syntax`
- Depend on the specific method used by an Effect, such as `reset`, rather than the entire `useForm`
  return object. Trigger resets from an intentional data or identity change, not from an Effect that
  runs on every form-state update. `enforced-by: typescript/eslint no-restricted-syntax`

See [reset options](https://react-hook-form.com/docs/useform/reset).

## Register inputs and controlled components

Use `register` for native inputs and components that forward the native input contract. Preserve its `enforced-by: typescript/eslint no-restricted-syntax`
`name`, `ref`, `onChange`, and `onBlur`. Use `Controller` or `useController` for an external
controlled component whose value, event, or ref props need an adapter.

- Give each logical field a stable, typed path. Checkbox and radio groups may share a logical name
  according to their registration contract; unrelated inputs must not overwrite the same field. `enforced-by: typescript/eslint no-restricted-syntax`
- Register a controlled field once. Never spread both `field` from `Controller` and `register(name)`
  onto the same input. `enforced-by: typescript/eslint no-restricted-syntax`
- Forward `field.value`, `field.onChange`, `field.onBlur`, `field.name`, `field.disabled`, and the
  ref to their matching component props. Wire the ref to the actual focusable input, using the UI
  library's `inputRef` or equivalent when necessary. `enforced-by: typescript/eslint no-restricted-syntax`
- Set controlled defaults at `useForm`. Do not send `undefined` through
  `field.onChange`; choose an empty value supported by the control and schema. `enforced-by: typescript/eslint no-restricted-syntax`
- Send changes through `field.onChange`. Do not also call `setValue` for the same event. Use
  `setValue` for an intentional programmatic update, with `shouldDirty`, `shouldTouch`, and
  `shouldValidate` selected for that operation. `enforced-by: typescript/eslint no-restricted-syntax`
- When overriding an event or value conversion, spread `field` first and retain its remaining props.
  Losing `onBlur` breaks touched/blur validation; losing `ref` breaks error focus. `enforced-by: typescript/eslint no-restricted-syntax`
- Treat disabled values as potentially absent from submission. In particular, a disabled
  `Controller` omits its value. Use a supported read-only control when the value must remain in the
  payload, and derive trusted identifiers again on the server. `enforced-by: typescript/eslint no-restricted-syntax`
- Manage file selection and cancellation deliberately. A `FileList` is not a normal text default;
  decide how empty selection, replacement, reset, and upload state behave. `enforced-by: typescript/eslint no-restricted-syntax`

See [Controller](https://react-hook-form.com/docs/usecontroller/controller).

## Define validation and parsed types

Choose one validation authority for the form. With `zodResolver`, express validation in the schema; `enforced-by: typescript/eslint no-restricted-syntax`
do not expect built-in `register` validators or the form-level `validate` option to execute as a
second validation layer. Native HTML constraints can still improve browser behavior, but must agree
with the schema.

- Infer form input and successful submission output separately when coercion or transforms change
  types. Defaults, field paths, and controls use the input model; the valid submit callback receives
  the resolver's parsed output. Keep resolver `raw` mode explicit if intentionally returning input. `enforced-by: typescript/eslint no-restricted-syntax`
- Use async resolver behavior for async refinements or transforms. Do not force synchronous
  resolution for a schema that returns promises. `enforced-by: typescript/eslint no-restricted-syntax`
- Normalize empty numbers, checkboxes, dates, and repeated values once at the boundary that owns
  that conversion. `valueAsNumber` can produce `NaN`; `parseInt` can accept an invalid trailing
  suffix. Do not silently turn a missing number into zero. `enforced-by: typescript/eslint no-restricted-syntax`
- For a numeric control, support its editing states before committing a domain value. An empty
  input, a minus sign, and a complete integer are different states. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `mode` and `reValidateMode` for the desired feedback timing. Avoid expensive whole-form or
  network validation on every keystroke. Controlled fields must forward `onBlur` for blur-based
  modes to work. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `criteriaMode: 'all'` only when the UI will display the extra issues. With built-in
  validation, reserve `useForm.validate` for form-level rules on a supporting version. It does not
  run alongside a configured resolver. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep custom resolver errors hierarchical. A literal key such as `participants.1.name` is not a
  nested error object. Return both `values` and `errors`, with the shape the resolver API expects. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep browser schemas free of server-only dependencies. Repeat validation and authorization at the
  server entry point; a valid client callback is not a trusted request. `enforced-by: typescript/eslint no-restricted-syntax`

For example, a schema can accept the input's text and return a number without pretending the input
already stores a number:

```tsx
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const quantitySchema = z.object({
    quantity: z.string().regex(/^\d+$/).transform(Number).pipe(z.int().min(1)),
});

function useQuantityForm() {
    return useForm<z.input<typeof quantitySchema>, unknown, z.output<typeof quantitySchema>>({
        resolver: zodResolver(quantitySchema),
        defaultValues: { quantity: '' },
    });
}
```

The server may receive the parsed number rather than the original text. Validate that transport
contract explicitly; do not blindly run a string-only transform a second time on its output. See
[resolver type inference](https://github.com/react-hook-form/resolvers#typescript).

## Subscribe to the state a component needs

Use `useWatch` near the component that displays a changing value and `useFormState` near the `enforced-by: typescript/eslint no-restricted-syntax`
component that displays field or submission state. A broad root-level `watch()` can rerender the
whole form. Read the required `formState` properties during rendering so its Proxy establishes the
subscriptions; avoid conditional reads that skip a needed subscription.

- Use `getValues` for an imperative snapshot, not as a render subscription. `enforced-by: typescript/eslint no-restricted-syntax`
- Set up `useWatch` before updates it must observe. If a component mounts after an update, read the
  current value with `getValues` as well as subscribing to subsequent changes. `enforced-by: typescript/eslint no-restricted-syntax`
- Select field names and `exact` matching deliberately. Use `compute` on a supporting version for a
  derived display value; do not write that value back into the form during rendering. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `subscribe` for observation outside rendering. Return its unsubscribe function from the owning
  Effect. Do not call `setValue` or `reset` from its callback to feed updates back into the same
  subscription. `enforced-by: typescript/eslint no-restricted-syntax`
- Wait for `formState.isReady` before a child performs an initialization update that requires the
  parent's subscriptions. Distinguish readiness from async default loading. `enforced-by: typescript/eslint no-restricted-syntax`
- `dirtyFields` describes individual changes; use `isDirty` for the whole form. Choose whether a
  value restored to its default still counts as an unsaved change. `enforced-by: typescript/eslint no-restricted-syntax`

See [useWatch](https://react-hook-form.com/docs/usewatch),
[subscribe](https://react-hook-form.com/docs/useform/subscribe), and
[formState](https://react-hook-form.com/docs/useform/formstate).

## Manage field arrays

Use `useFieldArray` for editable rows with an object shape, such as `enforced-by: typescript/eslint no-restricted-syntax`
`{ items: [{ label: '', quantity: '' }] }`. Primitive arrays are not supported. Give each array one
hook owner and a stable `name`; do not create multiple hook instances for the same array or switch
one instance between unrelated array names.

- Render each row with the generated `field.id` as its React key. Use the current index in the
  registered field path. The key preserves row identity across insertions and reordering; the index
  identifies its current location in the submitted array. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep database IDs in a separate property such as `recordId`. Do not submit the generated render
  key as the persisted identifier. When adapting existing v7 data with an `id` property, account for
  the generated key inside `fields`, or use a supported custom `keyName` deliberately. `enforced-by: typescript/eslint no-restricted-syntax`
- Treat `fields` as the row structure and generated-key source, not a live value subscription. Read
  current values through `useWatch`, `getValues`, or submission. If combining watched values with
  row metadata, preserve the generated key rather than overwriting it with a domain ID. `enforced-by: typescript/eslint no-restricted-syntax`
- Supply complete row values to `append`, `prepend`, `insert`, and `update`. Do not pass an empty
  object or omit required defaults. Use a row factory when several operations need the same shape. `enforced-by: typescript/eslint no-restricted-syntax`
- `update` unmounts and remounts the affected row. Use `setValue` on a specific leaf when preserving
  focus, selection, or local widget state matters. Use `replace` for a deliberate whole-array
  replacement and check the resulting row identity and focus behavior. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `move` or `swap` for reordering and `remove(index)` for targeted deletion. Calling `remove()`
  without an index removes every row; make that intent explicit at the call site. `enforced-by: typescript/eslint no-restricted-syntax`
- Avoid stacking dependent array mutations in one event. Prefer a single operation that describes
  the final change. If a second operation must follow a render, guard it with the specific pending
  operation; do not add an unconditional mount Effect that deletes a row. `enforced-by: typescript/eslint no-restricted-syntax`
- Avoid `shouldUnregister: true` on forms or controllers that own field arrays. Reordering and
  remounting must not unregister and lose row values. `enforced-by: typescript/eslint no-restricted-syntax`
- Use built-in array `rules` only with the built-in validation path. Its array-level errors appear
  at `errors.<arrayName>.root`. With a resolver, render errors from the resolver's actual nested
  schema result instead of assuming that built-in path. `enforced-by: typescript/eslint no-restricted-syntax`
- On versions supporting field-array `disabled`, it disables the entire array and makes its mutation
  methods no-ops. The returned `field.disabled` mirrors the hook-level value; explicitly forward it
  to the input. It is not a per-row flag supplied to `append`. `enforced-by: typescript/eslint no-restricted-syntax`
- Choose `shouldFocus`, `focusName`, or `focusIndex` for additions according to the interaction. A
  background update never steals focus from the field being edited. `enforced-by: typescript/eslint no-restricted-syntax`

See [useFieldArray](https://react-hook-form.com/docs/usefieldarray).

## Preserve values across unmounts

Define whether hidden fields remain part of the draft and submission. The default `enforced-by: typescript/eslint no-restricted-syntax`
`shouldUnregister: false` retains values. With unregistering enabled, unmounting removes values and
changes how defaults contribute to submission. Keep the schema consistent with the selected branch;
unregistering a field does not rewrite a resolver schema that still requires it.

- For conditional fields, distinguish hidden-but-retained data from data that must be discarded.
  Keep hooks unconditional; extract a component for a branch that owns its own hooks. `enforced-by: typescript/eslint no-restricted-syntax`
- For wizard steps, keep one form provider above the steps or save drafts in an explicitly scoped
  owner. Validate the step before advancing and validate the complete payload on final submission.
  `enforced-by: typescript/eslint no-restricted-syntax`
- Do not create a server module singleton or persist credentials to preserve a wizard draft.
  `enforced-by: typescript/eslint no-restricted-syntax`
- For virtualized forms, keep the form owner mounted while rows enter and leave the viewport. Retain
  values across row unmounts, supply complete defaults, and use stable generated row keys. `enforced-by: typescript/eslint no-restricted-syntax`
- Integrate with the existing virtualizer instead of adding another one for forms. `enforced-by: typescript/eslint no-restricted-syntax`
- An offscreen invalid input cannot receive focus until its row is mounted. Resolve the error to the
  current row, scroll it into view, wait for its input ref, then focus it. Preserve errors and dirty
  values while the row is absent. `enforced-by: typescript/eslint no-restricted-syntax`
- Do not copy `fields` or initial defaults back over current edits when a row remounts. `enforced-by: typescript/eslint no-restricted-syntax`

## Submit and recover

Connect the form to one submission owner. Use `handleSubmit` to validate and call the valid handler;
await the actual save promise so `isSubmitting` reflects that work. When using TanStack Query,
`mutateAsync` provides an awaitable mutation; starting `mutate` and immediately returning does not
keep the form pending until the request finishes.

- Handle rejected promises at the submission boundary. `handleSubmit` does not swallow exceptions
  thrown by the valid submit callback. A DOM event handler must handle any returned rejection under
  the repository's promise policy. `enforced-by: typescript/eslint no-restricted-syntax`
- Show expected validation, conflict, or permission failures as safe structured results. Preserve
  values on recoverable failure and keep retry available. `enforced-by: typescript/eslint no-restricted-syntax`
- Prevent duplicate submissions using the state of the actual save operation. Server idempotency
  remains necessary where retries can duplicate a write. `enforced-by: typescript/eslint no-restricted-syntax`
- Do not use `isSubmitSuccessful` alone as proof that a domain write succeeded. A callback that
  catches a failure and returns normally may complete successfully from the form's perspective.
  Reset or navigate only after an explicit successful server result. `enforced-by: typescript/eslint no-restricted-syntax`
- On success, reconcile the returned canonical values with the form's input representation before
  resetting the baseline. Update query data or invalidate the affected queries through their
  existing owner. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep pending, validation, and result state distinct. Avoid a second loading flag that can disagree
  with `isSubmitting`, a mutation's pending state, or an Action's pending state. `enforced-by: typescript/eslint no-restricted-syntax`

## Integrate server actions and useActionState

Choose either a direct awaited Server Action call from the valid submit handler or a `enforced-by: typescript/eslint no-restricted-syntax`
`useActionState` integration when its result and pending state are useful. Send only values allowed
by the chosen transport. A Server Action validates its payload and authenticates and authorizes the
operation even when the browser already ran the same schema.

When manually calling the dispatcher returned by `useActionState`, call it inside `startTransition`.
Passing a dispatcher to a supported Action prop supplies that context; an ordinary `handleSubmit`
callback does not. For the manual pattern, use the Action's `isPending` during the server work
because dispatch does not return an awaitable save promise.

```tsx
const [result, dispatchSave, isPending] = useActionState(saveProfile, initialResult);

const submitValidated = handleSubmit((values) => {
    startTransition(() => {
        dispatchSave(values);
    });
});
```

This fragment assumes `useActionState` and `startTransition` from React, an existing typed form, and
a Server Action whose arguments are `(previousState, payload)`. Connect `submitValidated` to the
form with rejection handling for validation failures that throw. Keep the server validation contract
aligned with whether the payload contains raw field inputs or parsed output.

Do not mirror the Action's result or pending flag into local state through Effects. If it returns `enforced-by: typescript/eslint no-restricted-syntax`
field errors, an Effect may map that external result into `setError`. Validate returned field paths against the form contract and include the relevant method in
dependencies. Make sure a stale response does not overwrite errors for a different record or a newer
submission.

A JavaScript-only `onSubmit` bridge does not provide submission before hydration. If progressive
enhancement is required, use a supported native form Action or the installed React Hook Form `Form`
integration and verify submission without JavaScript. `progressive` forwards supported validation
attributes; `shouldUseNativeValidation` drives browser validity reporting. Neither option alone
establishes a server transport or server validation.

See React's [Action dispatch contract](https://react.dev/reference/react/useActionState) and React
Hook Form's [advanced usage](https://react-hook-form.com/advanced-usage).

## Present accessible errors

Connect each input to a visible label and associate its instructions and current error using stable
IDs and `aria-describedby`. Set `aria-invalid` from that field's validation state. Announce new
errors or a submission summary with an appropriate alert or live region without duplicating every
announcement.

- Use `fieldState.error` in controlled field components and the relevant nested error path in native
  field components. Keep parent/array errors visible as well as leaf errors. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `setError` for returned field failures and a form-level key such as `root.server` for a safe
  operation error. Clear or replace those errors when their cause is gone. `enforced-by: typescript/eslint no-restricted-syntax`
- Do not treat `clearErrors` as revalidation. Use `trigger` when validation must run again, and
  await its result before an action that depends on validity. `enforced-by: typescript/eslint no-restricted-syntax`
- Treat `isValid` as validation state, not proof of authorization or a successful save. A manual
  error's effect on it can be replaced by the next validation run. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep refs attached for `shouldFocusError` and `setFocus`. Do not focus immediately after a reset
  that has removed the input refs; wait for the relevant control to mount. `enforced-by: typescript/eslint no-restricted-syntax`
- Translate safe error codes and field messages through the existing internationalization layer. Do
  not display raw exceptions, SQL, submitted secrets, or resolver debug dumps. `enforced-by: typescript/eslint no-restricted-syntax`
- Use native validation only with compatible modes and actual input refs. Supply string messages and
  verify the browser's focus/reporting behavior with the custom controls in use. `enforced-by: typescript/eslint no-restricted-syntax`

## Compose form components

Use `FormProvider` and `useFormContext` when deeply nested descendants need the same form. Keep a `enforced-by: typescript/eslint no-restricted-syntax`
provider at the form's actual ownership boundary; avoid nested providers for the same form and do
not nest HTML forms. Prefer explicit typed field props or context over cloning arbitrary children
and guessing their registration needs from a `name` prop.

- Subscribe inside the smallest practical field or status component. Use `useController` when a
  reusable controlled field needs its own field state. `enforced-by: typescript/eslint no-restricted-syntax`
- Check React Hook Form DevTools overhead before diagnosing provider performance. Measure the actual
  form before adding broad memoization or custom equality code. `enforced-by: typescript/eslint no-restricted-syntax`
- Use `createFormControl` only when an explicit control owner or observation outside React is
  needed. Keep that instance stable for its lifetime and scoped to the correct form or request. `enforced-by: typescript/eslint no-restricted-syntax`
- With `createFormControl`, connect the returned `formControl` through `useForm({ formControl })`
  and pass its `control` to the consuming hooks. Use this explicit-control approach instead of
  adding a redundant `FormProvider` for the same control. `enforced-by: typescript/eslint no-restricted-syntax`
- Release external subscriptions on unmount or disposal. Reusing a control across editors must not
  carry one user's values, errors, or subscriptions into another editor. `enforced-by: typescript/eslint no-restricted-syntax`

See [createFormControl](https://react-hook-form.com/docs/createFormControl) and
[FormProvider](https://react-hook-form.com/docs/formprovider).

## Keep field paths precise

Use the library's `FieldPath`, `FieldArrayPath`, `Control`, and related types for reusable form `enforced-by: typescript/eslint no-restricted-syntax`
adapters. Infer them from the concrete input model. Do not widen every form to `FieldValues`, use
`any`, or cast arbitrary server strings into accepted field names.

- Preserve literal path types for indexed fields. Use an `as const` assertion when inference needs
  it; do not assert an unrelated valid path just to silence a type error. `enforced-by: typescript/eslint no-restricted-syntax`
- Model nested field arrays with their actual object shape. Keep runtime path construction aligned
  with the type and the current row index. `enforced-by: typescript/eslint no-restricted-syntax`
- Avoid circular form models. A recursive or cyclic schema supported by Zod does not establish that
  React Hook Form's path helpers support the same model. Project domain data into a finite editing
  model. `enforced-by: typescript/eslint no-restricted-syntax`
- On a release exposing `OpaqueTypes`, register an existing rich value type through module
  augmentation only when it is a leaf in field-path inference. Put the declaration in an
  included module file and preserve the original `react-hook-form` module declarations. `enforced-by: typescript/eslint no-restricted-syntax`
- Opaque registration changes type traversal; it does not validate the value, make class instances
  serializable, or fix default-value comparison. Prefer a plain editing representation when it
  avoids those runtime concerns. `enforced-by: typescript/eslint no-restricted-syntax`

## Test form behavior

Form tests cover the changed interaction using the existing runner and accessible queries. Await
asynchronous validation and submission results instead of adding sleeps.

Do not add form-test frameworks, fixtures, wrappers, or broad browser checks as part of ordinary `enforced-by: typescript/eslint no-restricted-syntax`
form implementation.

See the official [form testing guidance](https://react-hook-form.com/advanced-usage#TestingForm).
