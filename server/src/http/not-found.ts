import type { NextFunction, Request, Response } from "express";

import { NotFoundError } from "./errors.js";

/** JSON 404 for any API request that matched no route. */
export function notFound(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new NotFoundError("Route not found"));
}
