import { Request, Response, NextFunction } from "express";

import { accountRoleApi as AccountRolesAPITypes } from "@template/shared";

import {
  AccountRoleNotFoundError,
  restoreAccountRoleWithRetry,
} from "../../services/account-roles/restore.js";

import { Prisma } from "@prisma/client";

const handler = async (
  req: Request<{}, {}, AccountRolesAPITypes.RestoreRequestBody>,
  res: Response<AccountRolesAPITypes.RestoreResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const { roleId } = req.body;
  const userAccount = req.user!;

  try {
    const restoredRole = await restoreAccountRoleWithRetry(roleId, {
      traceId: req.id,
      userAccount,
    });

    res.status(200).json({
      status: "success",
      accountRole: restoredRole,
    });
  } catch (error: unknown) {
    const duration = performance.now() - start;

    if (error instanceof AccountRoleNotFoundError) {
      res.status(404).json({
        status: "role-not-found",
      });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      req.log.error(
        {
          source: "api:account-roles:restore",
          traceId: req.id,
          details: {
            code: error,
            meta: error,
          },
          duration,
        },
        "Prisma error during account role restore",
      );
    } else if (error instanceof Error) {
      req.log.error(
        {
          source: "api:account-roles:restore",
          traceId: req.id,
          details: {
            error: error.message,
            stack: error.stack,
          },
          duration,
        },
        "Error during account role restore",
      );
    }

    res.status(500).json({
      status: "internal-error",
    });
  }
};

export default handler;
