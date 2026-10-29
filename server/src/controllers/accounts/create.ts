import { Request, Response, NextFunction } from "express";

import { accountApi as AccountsAPITypes } from "@template/shared";

import prismaClient from "../../config/prisma.js";
import { createAccountWithRetry } from "../../services/accounts/create.js";

import { APIError } from "../../errors/api.js";

import { CampusCode } from "@prisma/client";

const handler = async (
  req: Request<{}, {}, AccountsAPITypes.CreateRequestBody>,
  res: Response<AccountsAPITypes.CreateResponseData>,
  _next: NextFunction,
) => {
  const { name, email, password, roleId, campus } = req.body;
  const adminAccount = req.user!;

  try {
    // Check if the email is in use
    const normalizedEmail = email.trim().toLowerCase();
    const existingAccount = await prismaClient.account.findMany({
      where: {
        email: normalizedEmail,
      },
      select: { id: true },
    });

    if (existingAccount.length > 0) {
      throw new APIError<AccountsAPITypes.CreateResponseData["status"]>(
        "email-in-use",
        400,
      );
    }

    // Check if the role exists
    const role = await prismaClient.accountRole.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      throw new APIError<AccountsAPITypes.CreateResponseData["status"]>(
        "role-not-found",
        400,
      );
    }

    const createdByAccountLevel = adminAccount.role?.level;
    if (
      role.level <= createdByAccountLevel &&
      role.level != createdByAccountLevel
    ) {
      throw new APIError<AccountsAPITypes.CreateResponseData["status"]>(
        "role-cannot-be-assigned",
        400,
      );
    }

    const createdAccount = await createAccountWithRetry(
      {
        name,
        email,
        campus: campus as CampusCode, // Checked by Zod schema, safe to assert
        password,
        roleId,
      },
      {
        traceId: req.id,
        userAccount: adminAccount,
      },
    );

    // Respond with created account (no logging here, service already logged)
    res.status(201).json({
      status: "success",
      account: createdAccount,
    });
  } catch (error: unknown) {
    if (error instanceof APIError) {
      res.status(error.httpStatus).send({ status: error.status });
      return;
    }

    if (error instanceof Error) {
      req.log.error(
        {
          source: "api:accounts:create",
          traceId: req.id,
          details: {
            error: error.message,
            stack: error.stack,
          },
        },
        "Error during user creation",
      );
      res.status(500).json({
        status: "internal-error",
      });
    }
  }
};

export default handler;
