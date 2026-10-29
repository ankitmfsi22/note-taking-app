import { zodResolver } from '@hookform/resolvers/zod';
import { LoginRequestSchema } from '@note-app/shared';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useLoginMutation } from '../queries';
import { applyServerError } from '../server-errors';
import { FormError, FormField } from './form-field';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useLoginMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      onSuccess();
    } catch (error) {
      applyServerError(error, setError, ['email', 'password']);
    }
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <FormField
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        registration={register('email')}
      />
      <FormField
        id="login-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        registration={register('password')}
      />
      <FormError message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
