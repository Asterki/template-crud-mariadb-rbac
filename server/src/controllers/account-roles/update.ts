import { Request, Response, NextFunction } from "express";
import { accountRoleApi as AccountRolesAPITypes } from "@template/shared";

import {
  AccountRoleNotFoundError,
  updateAccountRoleWithRetry,
} from "../../services/account-roles/update.js";

import { Prisma } from "@prisma/client";
import prismaClient from "../../config/prisma.js";

class CannotUpdateRoleAtThisLevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CannotUpdateRoleAtThisLevelError";
  }
}

class LevelInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelInUseError";
  }
}

const handler = async (
  req: Request<{}, {}, AccountRolesAPITypes.UpdateRequestBody>,
  res: Response<AccountRolesAPITypes.UpdateResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const { roleId, name, description, level, requiresTwoFactor, permissions } =
    req.body;
  const userAccount = req.user!;

  try {
    const userAccountRoleLevel = userAccount.role.level ?? 0;

    if (level !== undefined && level !== null) {
      if (level < userAccountRoleLevel) {
        throw new CannotUpdateRoleAtThisLevelError(
          "Cannot update a role at this level or lower than your own.",
        );
      }

      const existingRole = await prismaClient.accountRole.findFirst({
        where: {
          level,
          id: { not: roleId },
          metadata: {
            is: {
              deleted: false,
            },
          },
        },
        select: { id: true },
      });

      if (existingRole) {
        throw new LevelInUseError(`A role with level ${level} already exists.`);
      }
    }

    const roleToUpdate = await prismaClient.accountRole.findFirst({
      where: {
        id: roleId,
        metadata: {
          is: {
            deleted: false,
          },
        },
      },
      select: { id: true, level: true },
    });

    if (!roleToUpdate) {
      throw new AccountRoleNotFoundError("Account role not found or deleted");
    }

    if (
      (roleToUpdate.level !== undefined &&
        roleToUpdate.level < userAccountRoleLevel) ||
      roleToUpdate.level === -1 // Special case for default role with level -1
    ) {
      throw new CannotUpdateRoleAtThisLevelError(
        "Cannot update a role at this level or lower than your own.",
      );
    }

    const updatedRole = await updateAccountRoleWithRetry(
      {
        roleId,
        name,
        description,
        level,
        requiresTwoFactor,
        permissions,
      },
      {
        traceId: req.id,
        userAccount: userAccount,
      },
    );

    const duration = performance.now() - start;
    req.log.info(
      {
        source: "api:account-roles:update",
        traceId: req.id,
        duration,
        details: {
          updatedById: userAccount.id,
          accountRole: updatedRole.id,
        },
        _references: {
          updatedById: "Account",
          accountRoleId: "AccountRole",
        },
      },
      "Account role updated successfully",
    );

    res.status(200).json({
      status: "success",
      accountRole: updatedRole,
    });
  } catch (error: unknown) {
    const duration = performance.now() - start;

    if (error instanceof AccountRoleNotFoundError) {
      res.status(404).json({ status: "role-not-found" });
      return;
    }

    if (error instanceof LevelInUseError) {
      res.status(409).json({ status: "level-in-use" });
      return;
    }

    if (error instanceof CannotUpdateRoleAtThisLevelError) {
      res.status(403).json({ status: "level-too-high" });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      req.log.error(
        {
          source: "api:account-roles:update",
          traceId: req.id,
          details: { code: error, meta: error },
          duration,
        },
        "Prisma error during account role update",
      );
    } else if (error instanceof Error) {
      req.log.error(
        {
          source: "api:account-roles:update",
          traceId: req.id,
          details: { error: error.message, stack: error.stack },
          duration,
        },
        "Error during account role update",
      );
    }

    res.status(500).json({ status: "internal-error" });
  }
};

export default handler;
