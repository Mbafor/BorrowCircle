import crypto from 'crypto';
import { ValidationError } from '../utils/errors';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export interface UploadableFile {
  mimetype: string;
  size: number;
  originalname: string;
}

/**
 * Stubbed photo storage. No real provider is wired up yet — this is the only
 * place that needs to change when one (e.g. Supabase Storage, Cloudinary) is added.
 */
export async function uploadProfilePhoto(userId: string, file: UploadableFile): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ValidationError({ photo: 'Only JPEG, PNG, WEBP, or GIF images are allowed' });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError({ photo: 'Photo must be 5MB or smaller' });
  }

  const placeholderId = crypto.randomBytes(8).toString('hex');
  return `https://placeholder.borrowcircle.local/profile-photos/${userId}/${placeholderId}`;
}
