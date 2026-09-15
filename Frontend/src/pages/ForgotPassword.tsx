import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import { PrimaryButton, TextField } from '../components/FormField';
import { ApiError } from '../api/client';
import { forgotPassword } from '../api/auth';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      await forgotPassword({ email });
      setSent(true);
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

  if (sent) {
    return (
      <AuthCard title="Reset your password">
        <div className="py-1 text-center">
          <div className="mx-auto mb-4 flex h-[62px] w-[62px] items-center justify-center rounded-full bg-success-bg text-success-text">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="mb-1.5 text-[17px] font-bold">Reset link sent</p>
          <p className="mb-5 text-sm text-ink/60">
            If that email is registered, check your KNUST inbox for a link to reset your password.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            Back to log in
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email a reset link to your KNUST address.">
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

        <PrimaryButton type="submit" loading={submitting}>
          Send reset link
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
