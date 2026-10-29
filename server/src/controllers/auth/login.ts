import passport from "passport";

import AccountUtils from "../../utils/accounts.js";

import { NextFunction, Request, Response } from "express";
import { authApi as AuthAPITypes } from "@template/shared";

import { AccountWithRole } from "../../types/index.js";

const handler = (
  req: Request<{}, {}, AuthAPITypes.LoginRequestBody>,
  res: Response<AuthAPITypes.LoginResponseData>,
  next: NextFunction,
) => {
  try {
    passport.authenticate(
      "local",
      (err: any, user: AccountWithRole | null, info: any) => {
        if (err) {
          next(err);
          return;
        }

        if (!user) {
          res.status(403).send({
            status: info.message,
          });
          return;
        } else {
          req.logIn(user, async (err) => {
            if (err) {
              next(err);
              return;
            }

            res.status(200).send({
              status: "success",
              account: await AccountUtils.createSessionAccount(user),
            });
          });
        }
      },
    )(req, res, next);
  } catch (error: any) {
    req.log.error(
      {
        source: "api:auth:change-email",
        traceId: req.id,
        details: { error: error.message, stack: error.stack },
      },
      "Unexpected error during email change",
    );
    res.status(500).send({ status: "internal-error" });
  }
};

export default handler;
