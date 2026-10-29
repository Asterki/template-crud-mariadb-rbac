import { Request, Response, NextFunction } from "express";

import { accountApi as AccountAPITypes } from "@template/shared";
import {
  restoreAccountWithRetry,
  AccountNotFoundError,
} from "../../services/accounts/restore.js";

import { Prisma } from "@prisma/client";

const handler = async (
  req: Request<{}, {}, AccountAPITypes.RestoreRequestBody>,
  res: Response<AccountAPITypes.RestoreResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const { accountId } = req.body;
  const userAccount = req.user!;

  try {
    const restoredAccount = await restoreAccountWithRetry(accountId, {
      traceId: String(req.id),
      userAccount,
    });

    res.status(200).json({
      status: "success",
      account: restoredAccount,
    });
  } catch (error: unknown) {
    const duration = performance.now() - start;

    if (error instanceof AccountNotFoundError) {
      res.status(404).json({
        status: "account-not-found",
      });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      req.log.error(
        {
          source: "api:accounts:restore",
          traceId: String(req.id),
          details: {
            code: error,
            meta: error,
          },
          duration,
        },
        "Prisma error during account restore",
      );
    } else if (error instanceof Error) {
      req.log.error(
        {
          source: "api:accounts:restore",
          traceId: String(req.id),
          details: {
            error: error.message,
            stack: error.stack,
          },
          duration,
        },
        "Error during account restore",
      );
    }

    res.status(500).json({
      status: "internal-error",
    });
  }
};

export default handler;
