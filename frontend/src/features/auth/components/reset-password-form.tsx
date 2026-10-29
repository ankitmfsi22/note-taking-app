import { zodResolver } from '@hookform/resolvers/zod';
import { ResetPasswordRequestSchema } from '@note-app/shared';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useResetPasswordMutation } from '../queries';
import { applyServerError } from '../server-errors';
import { FormError, FormField } from './form-field';

interface ResetPasswordFormProps {
  email: string;
  onReset: () => void;
}

export function ResetPasswordForm({ email, onReset }: ResetPasswordFormProps) {
  const resetPassword = useResetPasswordMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ResetPasswordRequestSchema),
    defaultValues: { email, otp: '', newPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await resetPassword.mutateAsync(values);
      onReset();
    } catch (error) {
      applyServerError(error, setError, ['email', 'otp', 'newPassword']);
    }
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <FormField
        id="reset-password-email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        registration={register('email')}
      />
      <FormField
        id="reset-password-otp"
        label="6-digit code"
        autoComplete="one-time-code"
        error={errors.otp?.message}
        registration={register('otp')}
      />
      <FormField
        id="reset-password-new-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        registration={register('newPassword')}
      />
      <FormError message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Resetting…' : 'Reset password'}
      </Button>
    </form>
  );
}
