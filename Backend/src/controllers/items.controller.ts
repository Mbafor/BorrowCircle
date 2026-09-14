import { NextFunction, Request, Response } from 'express';
import * as itemsService from '../services/items.service';
import * as storageService from '../services/storage';
import { ValidationError } from '../utils/errors';
import { CreateItemBody, UpdateItemBody, UpdateItemStatusBody } from '../validation/items.validation';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CreateItemBody;
    const item = await itemsService.createItem(req.userId as string, body);
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await itemsService.getItemById(req.params.id, req.userId);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownItems = await itemsService.getOwnItems(req.userId as string);
    res.json({ items: ownItems });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as UpdateItemBody;
    const item = await itemsService.updateItem(req.params.id, req.userId as string, body);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await itemsService.deleteItem(req.params.id, req.userId as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body as UpdateItemStatusBody;
    const item = await itemsService.updateItemStatus(req.params.id, req.userId as string, status);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function uploadImages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await itemsService.assertItemOwnership(req.params.id, req.userId as string);

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw new ValidationError({ images: 'At least one image is required' });
    }
    const urls = await storageService.uploadItemImages(req.params.id, files);
    const item = await itemsService.setItemImages(req.params.id, req.userId as string, urls);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}
