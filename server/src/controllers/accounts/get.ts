import { Request, Response, NextFunction } from "express";
import prismaClient from "../../db/prisma.js";

import { accountApi as AccountAPITypes } from "@template/shared";

import { Prisma } from "@prisma/client";

type AccountInclude = Prisma.AccountInclude;
type AccountSelect = Prisma.AccountSelect;

import { getFieldsToPopulate, getFieldsToSelect } from "../../utils/prisma.js";

const handler = async (
  req: Request<{}, {}, AccountAPITypes.GetRequestBody>,
  res: Response<AccountAPITypes.GetResponseData>,
  _next: NextFunction,
) => {
  const start = performance.now();
  const { accountIds, fields, populate } = req.body;

  try {
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

    const accounts = await prismaClient.account.findMany({
      where: {
        id: {
          in: accountIds,
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
      accounts: accounts,
    });
  } catch (error: unknown) {
    const duration = performance.now() - start;

    if (error instanceof Error) {
      req.log.error(
        {
          source: "api:accounts:get",
          traceId: String(req.id),
          duration,
          details: {
            error: error.message,
            stack: error.stack,
            accountIds: accountIds,
          },
        },
        "Error during accounts retrieval",
      );
    }

    res.status(500).json({
      status: "internal-error",
    });
  }
};

export default handler;
