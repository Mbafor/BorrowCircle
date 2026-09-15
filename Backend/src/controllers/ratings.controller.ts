import { NextFunction, Request, Response } from 'express';
import * as ratingsService from '../services/ratings.service';
import { CreateRatingBody } from '../validation/ratings.validation';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CreateRatingBody;
    const rating = await ratingsService.createRating(req.userId as string, body);
    res.status(201).json({ rating });
  } catch (err) {
    next(err);
  }
}

export async function myPending(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pending = await ratingsService.getMyPendingRatings(req.userId as string);
    res.json({ pending });
  } catch (err) {
    next(err);
  }
}
