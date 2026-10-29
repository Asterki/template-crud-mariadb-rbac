import { Request, Response, NextFunction } from "express";
import prismaClient from "../../config/prisma.js";

import { accountRoleApi as AccountRolesAPITypes } from "@template/shared";

import { Prisma } from "@prisma/client";

type AccountRoleSelect = Prisma.AccountRoleSelect;
type AccountRoleInclude = Prisma.AccountRoleInclude;

import { getFieldsToPopulate, getFieldsToSelect } from "../../utils/prisma.js";

const handler = async (
  req: Request<{}, {}, AccountRolesAPITypes.GetRequestBody>,
  res: Response<AccountRolesAPITypes.GetResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const { roleIds, fields, populate } = req.body;

  try {
    const fieldsToSelect = getFieldsToSelect<AccountRoleSelect>(fields, {
      id: true,
      name: true,
    });
    const fieldsToPopulate = populate
      ? getFieldsToPopulate<
          AccountRoleInclude,
          NonNullable<AccountRolesAPITypes.ListRequestBody["populate"]>
        >(populate, {
          "metadata.createdBy": ["id", "name"],
          "metadata.updatedBy": ["id", "name"],
          "metadata.deletedBy": ["id", "name"],
        })
      : {};

    const roles = await prismaClient.accountRole.findMany({
      where: {
        id: {
          in: roleIds,
        },
        metadata: {
          is: {
            deleted: false,
          },
        },
      },
      select: {
        ...fieldsToSelect,
        ...fieldsToPopulate,
      },
    });

    res.status(200).json({
      status: "success",
      accountRoles: roles,
    });
  } catch (error: unknown) {
    const duration = performance.now() - start;

    if (error instanceof Error) {
      req.log.error(
        {
          source: "api:account-roles:get",
          traceId: req.id,
          duration,
          details: {
            error: error.message,
            stack: error.stack,
            roleIds,
          },
        },
        "Error during account roles retrieval",
      );
    }

    res.status(500).json({
      status: "internal-error",
    });
  }
};

export default handler;
