import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Direct bypass for local desktop execution
  (req as AuthenticatedRequest).userId = 'local_user';
  next();
};
