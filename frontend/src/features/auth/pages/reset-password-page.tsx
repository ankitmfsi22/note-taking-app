import { Link, useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useDocumentMeta } from '@/lib/use-document-meta';
import { ResetPasswordForm } from '../components/reset-password-form';

export function Component() {
  useDocumentMeta({
    title: 'Reset your password',
    description: 'Enter your one-time code and choose a new Note App password.',
    noindex: true,
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Reset your password</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm
          email={searchParams.get('email') ?? ''}
          onReset={() => void navigate('/login', { replace: true })}
        />
      </CardContent>
      <CardFooter>
        <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          Request a new code
        </Link>
      </CardFooter>
    </Card>
  );
}
