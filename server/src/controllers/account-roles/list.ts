import { Request, Response, NextFunction } from "express";

import { accountRoleApi as AccountRolesAPITypes } from "@template/shared";

import prismaClient from "../../db/prisma.js";

import { getFieldsToPopulate, getFieldsToSelect } from "../../utils/prisma.js";

import { Prisma } from "@prisma/client";

type AccountRoleSelect = Prisma.AccountRoleSelect;
type AccountRoleInclude = Prisma.AccountRoleInclude;

const handler = async (
  req: Request<{}, {}, AccountRolesAPITypes.ListRequestBody>,
  res: Response<AccountRolesAPITypes.ListResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const { page, count, fields, populate, search, includeDeleted } = req.body;

  try {
    const where: Prisma.AccountRoleWhereInput = {};
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

    if (search && search.query.length > 0 && search.searchIn.length > 0) {
      where.OR = search.searchIn.map((field) => ({
        [field]: {
          contains: search.query,
        },
      })) as Prisma.AccountRoleWhereInput[];
    }

    if (!includeDeleted) {
      where.metadata = {
        is: {
          deleted: {
            not: true, // Could be undefined
          },
        },
      };
    }

    const [accountRoles, totalAccountRoles] = await Promise.all([
      prismaClient.accountRole.findMany({
        where,
        skip: page * count,
        take: count,
        orderBy: {
          level: "asc",
        },
        select: {
          ...fieldsToSelect,
          ...fieldsToPopulate,
        },
      }),
      prismaClient.accountRole.count({ where }),
    ]);

    res.status(200).json({
      status: "success",
      accountRoles: accountRoles,
      totalAccountRoles: totalAccountRoles,
    });
  } catch (error: unknown) {
    const duration = performance.now() - start;

    if (error instanceof Error) {
      req.log.error(
        {
          source: "api:accounts-roles:list",
          traceId: String(req.id),
          details: { error: error.message, stack: error.stack },
          duration,
        },
        "Unexpected error during account roles listing",
      );
    }

    res.status(500).json({ status: "internal-error" });
    return;
  }
};

export default handler;
