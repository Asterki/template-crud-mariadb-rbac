import { Request, Response, NextFunction } from "express";

import { accountApi as AccountAPITypes } from "@template/shared";

import { updateAccountWithRetry } from "../../services/accounts/update.js";

import prismaClient from "../../db/prisma.js";

import { APIError } from "../../errors/api.js";

const handler = async (
  req: Request<{}, {}, AccountAPITypes.UpdatePasswordRequestBody>,
  res: Response<AccountAPITypes.UpdatePasswordResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const userAccount = req.user!;
  const { accountId, newPassword } = req.body;

  try {
    const roleLevelOfAccountToUpdate = await prismaClient.account.findUnique({
      where: { id: accountId },
      select: {
        role: {
          select: {
            level: true,
          },
        },
      },
    });

    if (!roleLevelOfAccountToUpdate) {
      throw new APIError<AccountAPITypes.UpdatePasswordResponseData["status"]>(
        "account-not-found",
        404,
      );
    }

    const adminRoleLevel = userAccount.role.level ?? 1000;
    if (roleLevelOfAccountToUpdate.role.level <= adminRoleLevel) {
      throw new APIError<AccountAPITypes.UpdatePasswordResponseData["status"]>(
        "cannot-change-password-due-to-role-level",
        401,
      );
    }

    await updateAccountWithRetry(
      {
        accountId,
        password: newPassword,
      },
      {
        traceId: String(req.id),
        userAccount: userAccount,
      },
    );

    res.status(200).json({
      status: "success",
    });
  } catch (error: unknown) {
    const duration = performance.now() - start;

    if (error instanceof APIError) {
      res.status(error.httpStatus).json({ status: error.status });
      return;
    }

    req.log.error(
      {
        source: "api:accounts:update-password",
        traceId: String(req.id),
        duration,
        details: {
          error: (error as any)?.message,
          stack: (error as any)?.stack,
          accountId,
        },
      },
      "Unexpected error during account password update",
    );

    res.status(500).json({ status: "internal-error" });
  }
};

export default handler;
