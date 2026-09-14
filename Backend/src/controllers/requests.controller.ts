import { NextFunction, Request, Response } from 'express';
import * as requestsService from '../services/requests.service';
import { CreateRequestBody, DeclineRequestBody, IncomingRequestsQuery } from '../validation/requests.validation';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CreateRequestBody;
    const request = await requestsService.createRequest(req.userId as string, body);
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requests = await requestsService.getMyRequests(req.userId as string);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await requestsService.getRequestById(req.params.id, req.userId as string);
    res.json({ request });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await requestsService.cancelRequest(req.params.id, req.userId as string);
    res.json({ request });
  } catch (err) {
    next(err);
  }
}

export async function getIncoming(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as IncomingRequestsQuery;
    const requests = await requestsService.getIncomingRequests(req.userId as string, query);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

export async function accept(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await requestsService.acceptRequest(req.params.id, req.userId as string);
    res.json({ request });
  } catch (err) {
    next(err);
  }
}

export async function decline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body as DeclineRequestBody;
    const request = await requestsService.declineRequest(req.params.id, req.userId as string, reason);
    res.json({ request });
  } catch (err) {
    next(err);
  }
}
