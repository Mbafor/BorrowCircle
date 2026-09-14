import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { ValidationError } from '../utils/errors';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ITEM_IMAGES = 3;

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('photo');

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).array('images', MAX_ITEM_IMAGES);

function multerErrorMessage(err: MulterError, field: string): string {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return `Each ${field === 'photo' ? 'photo' : 'image'} must be 5MB or smaller`;
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return `You can upload at most ${MAX_ITEM_IMAGES} images`;
    default:
      return err.message;
  }
}

export function uploadSinglePhoto(req: Request, res: Response, next: NextFunction): void {
  uploadPhoto(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      next(new ValidationError({ photo: multerErrorMessage(err, 'photo') }));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

export function uploadItemImageFiles(req: Request, res: Response, next: NextFunction): void {
  uploadImages(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      next(new ValidationError({ images: multerErrorMessage(err, 'images') }));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}
