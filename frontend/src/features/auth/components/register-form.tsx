import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterRequestSchema } from '@note-app/shared';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useRegisterMutation } from '../queries';
import { applyServerError } from '../server-errors';
import { FormError, FormField } from './form-field';

// The shared schema rejects an empty display name, so a blank field is sent as "not given".
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const registerUser = useRegisterMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(RegisterRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser.mutateAsync(values);
      onSuccess();
    } catch (error) {
      applyServerError(error, setError, ['email', 'password', 'displayName']);
    }
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <FormField
        id="register-email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        registration={register('email')}
      />
      <FormField
        id="register-password"
        label="Password"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        registration={register('password')}
      />
      <FormField
        id="register-display-name"
        label="Display name (optional)"
        autoComplete="nickname"
        error={errors.displayName?.message}
        registration={register('displayName', { setValueAs: blankToUndefined })}
      />
      <FormError message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
