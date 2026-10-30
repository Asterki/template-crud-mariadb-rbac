import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wrap an async handler and forward rejections to Express.
 *
 * Express 5 already forwards rejected promises, but this helper keeps handler
 * signatures explicitly asynchronous and works with older router types.
 */
export function asyncHandler(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
