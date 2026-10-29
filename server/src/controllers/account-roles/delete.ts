import { Request, Response, NextFunction } from "express";
import { accountRoleApi as AccountRolesAPITypes } from "@template/shared";

import {
  AccountRoleNotFoundError,
  deleteAccountRoleWithRetry,
} from "../../services/account-roles/delete.js";

import { Prisma } from "@prisma/client";

const handler = async (
  req: Request<{}, {}, AccountRolesAPITypes.DeleteRequestBody>,
  res: Response<AccountRolesAPITypes.DeleteResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const { roleId } = req.body;
  const userAccount = req.user!;

  try {
    const deletedRole = await deleteAccountRoleWithRetry(roleId, {
      traceId: req.id,
      userAccount: userAccount,
    });

    res.status(200).json({
      status: "success",
      accountRole: deletedRole,
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
          source: "api:account-roles:delete",
          traceId: req.id,
          details: {
            code: error,
            meta: error,
          },
          duration,
        },
        "Prisma error during account role deletion",
      );
    } else if (error instanceof Error) {
      req.log.error(
        {
          source: "api:account-roles:delete",
          traceId: req.id,
          details: {
            error: error.message,
            stack: error.stack,
          },
          duration,
        },
        "Error during account role deletion",
      );
    }

    res.status(500).json({
      status: "internal-error",
    });
  }
};

export default handler;
