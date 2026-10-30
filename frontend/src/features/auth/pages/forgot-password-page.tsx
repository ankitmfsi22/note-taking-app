import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useDocumentMeta } from '@/lib/use-document-meta';
import { ForgotPasswordForm } from '../components/forgot-password-form';

export function Component() {
  useDocumentMeta({
    title: 'Forgot your password',
    description: 'Request a one-time code to reset your Note App password.',
  });
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Forgot your password?</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm
          onRequested={(email) =>
            void navigate(`/reset-password?email=${encodeURIComponent(email)}`)
          }
        />
      </CardContent>
      <CardFooter>
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
