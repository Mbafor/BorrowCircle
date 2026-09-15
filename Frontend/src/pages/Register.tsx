import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import { PrimaryButton, SelectField, TextField } from '../components/FormField';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { LOCATIONS } from '../constants/locations';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      await register({ fullName, email, password, phoneNumber, location });
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
    <AuthCard title="Join BorrowCircle">
      <form onSubmit={handleSubmit} className="grid gap-3.5" noValidate>
        {formError && (
          <p className="rounded-2xl bg-danger-bg px-4 py-2.5 text-sm font-medium text-danger-text">{formError}</p>
        )}

        <TextField
          label="Full name"
          id="fullName"
          autoComplete="name"
          placeholder="Joshua Mensah"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fieldErrors.fullName}
          required
        />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />
        <TextField
          label="Phone number"
          id="phoneNumber"
          type="tel"
          autoComplete="tel"
          placeholder="024 000 0000"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          error={fieldErrors.phoneNumber}
          required
        />
        <SelectField
          label="Hostel / location"
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          error={fieldErrors.location}
          required
        >
          <option value="" disabled>
            Select a location
          </option>
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </SelectField>

        <PrimaryButton type="submit" loading={submitting}>
          Create account
        </PrimaryButton>

        <div className="text-center text-[13.5px] text-ink/60">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-primary hover:text-primary-hover">
            Log in
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
