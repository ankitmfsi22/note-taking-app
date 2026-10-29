import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '../components/register-form';

export function Component() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Create account</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RegisterForm onSuccess={() => void navigate('/notes', { replace: true })} />
      </CardContent>
      <CardFooter>
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in instead
        </Link>
      </CardFooter>
    </Card>
  );
}
