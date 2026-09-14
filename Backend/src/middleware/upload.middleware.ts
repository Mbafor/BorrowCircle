import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { ValidationError } from '../utils/errors';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('photo');

export function uploadSinglePhoto(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 5MB or smaller' : err.message;
      next(new ValidationError({ photo: message }));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}
