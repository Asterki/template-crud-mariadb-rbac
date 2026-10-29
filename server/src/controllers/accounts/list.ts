import { Request, Response, NextFunction } from "express";

import { accountApi as AccountAPITypes } from "@template/shared";

import prismaClient from "../../config/prisma.js";

import { getFieldsToPopulate, getFieldsToSelect } from "../../utils/prisma.js";

import { Prisma } from "@prisma/client";

type AccountInclude = Prisma.AccountInclude;
type AccountSelect = Prisma.AccountSelect;

const handler = async (
  req: Request<{}, {}, AccountAPITypes.ListRequestBody>,
  res: Response<AccountAPITypes.ListResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const { page, count, fields, populate, filters, search, includeDeleted } =
    req.body;

  try {
    const where: Prisma.AccountWhereInput = {};
    const fieldsToSelect = getFieldsToSelect<AccountSelect>(fields, {
      id: true,
      name: true,
    });
    const fieldsToPopulate = populate
      ? getFieldsToPopulate<
          AccountInclude,
          NonNullable<AccountAPITypes.ListRequestBody["populate"]>
        >(populate, {
          "metadata.createdBy": ["id", "name"],
          "metadata.updatedBy": ["id", "name"],
          "metadata.deletedBy": ["id", "name"],
          role: ["id", "name", "level"],
        })
      : {};

    if (search && search.query.length > 0 && search.searchIn.length > 0) {
      where.OR = search.searchIn.map((field) => ({
        [field]: {
          contains: search.query,
        },
      })) as Prisma.AccountWhereInput[];
    }

    if (filters) {
      if (filters.role) {
        where.roleId = filters.role;
      }
      if (filters.status) {
        where.status = filters.status;
      }
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

    const [accounts, totalAccounts] = await Promise.all([
      prismaClient.account.findMany({
        where,
        skip: page * count,
        take: count,
        orderBy: {
          name: "asc",
        },
        select: {
          ...fieldsToSelect,
          ...fieldsToPopulate,
        },
      }),
      prismaClient.account.count({ where }),
    ]);

    res.status(200).json({
      status: "success",
      accounts,
      totalAccounts,
    });
  } catch (error: unknown) {
    const duration = performance.now() - start;

    if (error instanceof Error) {
      req.log.error(
        {
          source: "api:accounts:list",
          traceId: req.id,
          details: { error: error.message, stack: error.stack },
          duration,
        },
        "Unexpected error during account listing",
      );
    }

    res.status(500).json({ status: "internal-error" });
    return;
  }
};

export default handler;
