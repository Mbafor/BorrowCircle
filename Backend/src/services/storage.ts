import crypto from 'crypto';
import { ValidationError } from '../utils/errors';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ITEM_IMAGES = 3;

export interface UploadableFile {
  mimetype: string;
  size: number;
  originalname: string;
}

function assertValidImage(field: string, file: UploadableFile): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ValidationError({ [field]: 'Only JPEG, PNG, WEBP, or GIF images are allowed' });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError({ [field]: 'Each image must be 5MB or smaller' });
  }
}

/**
 * Stubbed photo storage. No real provider is wired up yet — this is the only
 * place that needs to change when one (e.g. Supabase Storage, Cloudinary) is added.
 */
export async function uploadProfilePhoto(userId: string, file: UploadableFile): Promise<string> {
  assertValidImage('photo', file);

  const placeholderId = crypto.randomBytes(8).toString('hex');
  return `https://placeholder.borrowcircle.local/profile-photos/${userId}/${placeholderId}`;
}

/**
 * Stubbed item image storage, same pattern as uploadProfilePhoto above.
 */
export async function uploadItemImages(itemId: string, files: UploadableFile[]): Promise<string[]> {
  if (files.length === 0) {
    throw new ValidationError({ images: 'At least one image is required' });
  }

  if (files.length > MAX_ITEM_IMAGES) {
    throw new ValidationError({ images: `You can upload at most ${MAX_ITEM_IMAGES} images` });
  }

  files.forEach((file) => assertValidImage('images', file));

  return files.map(() => {
    const placeholderId = crypto.randomBytes(8).toString('hex');
    return `https://placeholder.borrowcircle.local/item-photos/${itemId}/${placeholderId}`;
  });
}
