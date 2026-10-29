import { zodResolver } from '@hookform/resolvers/zod';
import {
  TAG_COLOR_DEFAULT,
  TagCreateRequestSchema,
  TagUpdateRequestSchema,
  type TagCreateRequest,
  type TagUpdateRequest,
} from '@note-app/shared';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormError, FormField } from '@/features/auth/components/form-field';
import { applyServerError } from '@/features/auth/server-errors';
import { ApiError } from '@/lib/api-client';

export const TAG_NAME_TAKEN_MESSAGE = 'A tag with this name already exists.';

const isNameTaken = (error: unknown) =>
  error instanceof ApiError && error.code === 'TAG_NAME_TAKEN';

const takenName = { type: 'server', message: TAG_NAME_TAKEN_MESSAGE } as const;

interface CreateTagFormProps {
  onSubmit: (values: TagCreateRequest) => Promise<unknown>;
}

export function CreateTagForm({ onSubmit }: CreateTagFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(TagCreateRequestSchema),
    defaultValues: { name: '', color: TAG_COLOR_DEFAULT },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      reset({ name: '', color: getValues('color') ?? TAG_COLOR_DEFAULT });
    } catch (error) {
      // A taken name goes on the name field; details and the rest use the shared mapping.
      if (isNameTaken(error)) setError('name', takenName);
      else applyServerError(error, setError, ['name', 'color']);
    }
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-wrap items-start gap-3"
    >
      <FormField
        id="tag-name-new"
        label="New tag name"
        error={errors.name?.message}
        registration={register('name')}
      />
      <FormField
        id="tag-color-new"
        label="New tag color"
        type="color"
        error={errors.color?.message}
        registration={register('color')}
      />
      <div className="flex flex-col gap-1.5 self-end">
        <Button type="submit" disabled={isSubmitting}>
          Add tag
        </Button>
      </div>
      <FormError message={errors.root?.server?.message} />
    </form>
  );
}

interface EditTagFormProps {
  initial: { name: string; color: string };
  onSubmit: (values: TagUpdateRequest) => Promise<unknown>;
  onCancel: () => void;
}

export function EditTagForm({ initial, onSubmit, onCancel }: EditTagFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(TagUpdateRequestSchema),
    defaultValues: initial,
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      if (isNameTaken(error)) setError('name', takenName);
      else applyServerError(error, setError, ['name', 'color']);
    }
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-wrap items-start gap-3"
    >
      <FormField
        id="tag-name-edit"
        label="Tag name"
        error={errors.name?.message}
        registration={register('name')}
      />
      <FormField
        id="tag-color-edit"
        label="Tag color"
        type="color"
        error={errors.color?.message}
        registration={register('color')}
      />
      <div className="flex gap-2 self-end">
        <Button type="submit" disabled={isSubmitting}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <FormError message={errors.root?.server?.message} />
    </form>
  );
}
