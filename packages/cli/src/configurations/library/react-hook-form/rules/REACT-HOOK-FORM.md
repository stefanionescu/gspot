# React Hook Form

Read this rule when you change a form built with React Hook Form.

## Form ownership and validation

- One `useForm` instance owns a form. Use `FormProvider` when nested fields need it; never create a second `useForm`
  instance for the same submission.
- The resolver owns schema validation. Keep coercion and validation in that path rather than maintaining competing rules
  in fields and submit handlers.
- Initialize `defaultValues` with the form's complete starting values. Reset deliberately when the edited record
  switches; an incoming background response must not discard a user's changes.
- An input uses either `register` or `Controller`. A controlled widget forwards the value of the controller, its change
  handler, and its blur handlers, ref, and disabled state through its supported interface.
- Subscribe through `useWatch` or `useFormState` near the consumer instead of making the entire form rerender for every
  field. `getValues` reads a snapshot rather than subscribing.
- Conditional fields separate hidden values that stay in the submission from ones that need removal. The schema follows
  that choice.

## Field arrays

- Give each field array one `useFieldArray` call. Use `field.id` as the React key and the current index in a registered
  path. Store database identity in a separate property.
- Treat `fields` as row structure. Read live values through the form's APIs.
- Add complete rows. Use a leaf `setValue` when an update must preserve the mounted row's focus and widget state;
  `update` remounts it.
- Keep one `useForm` instance across wizard steps. Validate a step before advancing and the whole payload before the
  final submission.

## Submission and errors

- The submit handler awaits the real save. Pending state lasts until that operation settles; starting a request and
  returning early makes `isSubmitting` misleading.
- Show field errors beside their inputs and form errors at the boundary. Keep entered values after a failed save so the
  user can correct or retry them.
- When the project uses TanStack Query and submission needs the mutation result, await `mutateAsync`. Handle its
  rejection in the form's error path.
- When the project uses Next.js Server Actions, await the action and map its returned validation or save result into the
  form's error state.
- When the project uses an internationalization library, pass error messages through its message API rather than
  building translated sentences from fragments.

## References

- [useForm](https://react-hook-form.com/docs/useform)
- [Resolvers](https://github.com/react-hook-form/resolvers)
- [Controller](https://react-hook-form.com/docs/usecontroller/controller)
- [useFieldArray](https://react-hook-form.com/docs/usefieldarray)
- [handleSubmit](https://react-hook-form.com/docs/useform/handlesubmit)
