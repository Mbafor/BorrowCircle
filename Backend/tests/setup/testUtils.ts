import { Response } from 'supertest';

let counter = 0;

export function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now()}${counter}`;
}

export function validRegisterPayload(overrides: Partial<Record<string, string>> = {}) {
  const suffix = uniqueSuffix();
  return {
    fullName: 'Ama Mensah',
    email: `student${suffix}@st.knust.edu.gh`,
    password: 'Str0ngPass!',
    location: 'Republic Hall',
    phoneNumber: `0${suffix.slice(-9).padStart(9, '1')}`,
    ...overrides,
  };
}

export function validItemPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: 'Scientific Calculator',
    description: 'Good condition, suitable for engineering courses.',
    category: 'Electronics',
    location: 'Unity Hall',
    borrowType: 'FREE',
    ...overrides,
  };
}

export function extractCookie(res: Response, name: string): string | undefined {
  const rawCookies = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) {
    return undefined;
  }
  const value = match.split(';')[0].split('=')[1];
  return decodeURIComponent(value);
}
