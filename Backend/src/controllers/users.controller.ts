import { NextFunction, Request, Response } from 'express';
import * as usersService from '../services/users.service';
import * as storageService from '../services/storage';
import { ValidationError } from '../utils/errors';
import { UpdateProfileBody } from '../validation/users.validation';

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await usersService.getOwnProfile(req.userId as string);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function getPublicProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await usersService.getPublicProfile(req.params.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as UpdateProfileBody;
    const user = await usersService.updateProfile(req.userId as string, body);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new ValidationError({ photo: 'A photo file is required' });
    }
    const url = await storageService.uploadProfilePhoto(req.userId as string, req.file);
    const user = await usersService.updateProfilePhoto(req.userId as string, url);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function deleteMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await usersService.deleteAccount(req.userId as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
