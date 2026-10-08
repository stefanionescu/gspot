---
title: React Hook Form
---

# React Hook Form

## Form ownership and validation

- One `useForm` instance owns a form. Use `FormProvider` when nested fields need that instance;
  never create a second form owner for the same submission.
- The resolver owns schema validation. Keep coercion and validation in that path rather than
  maintaining competing rules in fields and submit handlers.
- Initialize `defaultValues` with the form's complete starting values. Reset deliberately when the
  edited record changes; an incoming background response must not discard a user's changes.
- An input uses either `register` or `Controller`. A controlled widget forwards the controller's
  value, change handler, blur handler, ref, and disabled state through its supported interface.
- Subscribe through `useWatch` or `useFormState` near the consumer instead of making the entire form
  rerender for every field. `getValues` reads a snapshot rather than subscribing.
- Conditional fields distinguish hidden values that remain part of the submission from values that
  must be removed. The schema follows that choice.

## Field arrays

- Give each field array one `useFieldArray` owner. Use `field.id` as the React key and the current
  index in a registered path. Store database identity in a separate property.
- Treat `fields` as row structure. Read live values through the form's value APIs.
- Add complete rows. Use a leaf `setValue` when an update must preserve the mounted row's focus and
  widget state; `update` remounts the row.
- Keep one form owner across wizard steps. Validate a step before advancing and the whole payload
  before the final submission.

## Submission and errors

- The submit handler awaits the real save. Pending state lasts until that operation settles;
  starting a request and returning early makes `isSubmitting` misleading.
- Report field errors beside their fields and form errors at the form boundary. Keep entered values
  after a failed save so the user can correct or retry them.
- A save captures the edited record's identity. Its late result must not reset a different record.
- When the project uses TanStack Query, await `mutateAsync` when submission needs the mutation result.
  Handle its rejection in the form's error path.
- When the project uses Next.js Server Actions, await the action and map its returned validation or
  save result into the form's error state.
- When the project uses an internationalization library, pass error messages through that library's
  message API rather than constructing translated sentences from fragments.

## References

- [useForm](https://react-hook-form.com/docs/useform)
- [Resolvers](https://github.com/react-hook-form/resolvers)
- [Controller](https://react-hook-form.com/docs/usecontroller/controller)
- [useFieldArray](https://react-hook-form.com/docs/usefieldarray)
- [handleSubmit](https://react-hook-form.com/docs/useform/handlesubmit)
