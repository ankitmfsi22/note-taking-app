import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '../components/login-form';

export function Component() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Sign in</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <LoginForm onSuccess={() => void navigate('/notes', { replace: true })} />
      </CardContent>
      <CardFooter className="justify-between">
        <Link to="/register" className="text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
        <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </CardFooter>
    </Card>
  );
}
