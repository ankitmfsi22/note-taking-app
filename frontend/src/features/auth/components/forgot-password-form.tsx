import { zodResolver } from '@hookform/resolvers/zod';
import { ForgotPasswordRequestSchema } from '@note-app/shared';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useForgotPasswordMutation } from '../queries';
import { applyServerError } from '../server-errors';
import { FormError, FormField } from './form-field';

export function ForgotPasswordForm({ onRequested }: { onRequested: (email: string) => void }) {
  const forgotPassword = useForgotPasswordMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ForgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgotPassword.mutateAsync(values);
      onRequested(values.email);
    } catch (error) {
      applyServerError(error, setError, ['email']);
    }
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <FormField
        id="forgot-password-email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        registration={register('email')}
      />
      <FormError message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset code'}
      </Button>
    </form>
  );
}
