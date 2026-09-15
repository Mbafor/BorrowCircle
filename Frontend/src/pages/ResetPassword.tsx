import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import { PrimaryButton, TextField } from '../components/FormField';
import { ApiError } from '../api/client';
import { resetPassword } from '../api/auth';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!token) {
      setFormError('This reset link is missing its token. Request a new one.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ token, newPassword });
      navigate('/login', { replace: true });
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
    <AuthCard title="Reset your password">
      <form onSubmit={handleSubmit} className="grid gap-3.5" noValidate>
        {formError && (
          <p className="rounded-2xl bg-danger-bg px-4 py-2.5 text-sm font-medium text-danger-text">{formError}</p>
        )}

        {!token && (
          <p className="rounded-2xl bg-warning-bg px-4 py-2.5 text-sm font-medium text-warning-text">
            No reset token found in this link. Request a new one from the forgot-password page.
          </p>
        )}

        <TextField
          label="New password"
          id="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={fieldErrors.newPassword}
          required
        />

        <PrimaryButton type="submit" loading={submitting} disabled={!token}>
          Reset password
        </PrimaryButton>

        <div className="text-center text-[13.5px] text-ink/60">
          <Link to="/login" className="font-bold text-primary hover:text-primary-hover">
            Back to log in
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
