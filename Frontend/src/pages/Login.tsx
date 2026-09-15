import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import { PrimaryButton, TextField } from '../components/FormField';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Welcome back">
      <form onSubmit={handleSubmit} className="grid gap-3.5" noValidate>
        {formError && (
          <p className="rounded-2xl bg-danger-bg px-4 py-2.5 text-sm font-medium text-danger-text">{formError}</p>
        )}

        <TextField
          label="KNUST student email"
          id="email"
          type="email"
          autoComplete="email"
          placeholder="joshua.mensah@st.knust.edu.gh"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          required
        />
        <TextField
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />

        <div className="text-right">
          <Link to="/forgot-password" className="text-[13px] font-semibold text-primary hover:text-primary-hover">
            Forgot password?
          </Link>
        </div>

        <PrimaryButton type="submit" loading={submitting}>
          Log in
        </PrimaryButton>

        <div className="text-center text-[13.5px] text-ink/60">
          New here?{' '}
          <Link to="/register" className="font-bold text-primary hover:text-primary-hover">
            Create an account
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
