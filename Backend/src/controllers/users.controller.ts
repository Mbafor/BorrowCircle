import { NextFunction, Request, Response } from 'express';
import * as usersService from '../services/users.service';
import * as storageService from '../services/storage';
import * as ratingsService from '../services/ratings.service';
import { ValidationError } from '../utils/errors';
import { UpdateProfileBody } from '../validation/users.validation';
import { ReviewsQuery } from '../validation/ratings.validation';

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
    const user = await usersService.getPublicProfile(req.params.id, req.userId);
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

export async function getReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as ReviewsQuery;
    const result = await ratingsService.getReviewsForUser(req.params.id, query);
    res.json(result);
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
