import type { Express } from "express";
import passport from "passport";
import passportLocal from "passport-local";
import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";

import type { AppConfig } from "../config/index.js";

export type SessionDependencies = {
  config: AppConfig;
  prisma: PrismaClient;
  logger: Logger;
};

export function createSessionManager({
  config,
  prisma,
  logger,
}: SessionDependencies) {
  const sessionMiddleware = session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: "lax",
      httpOnly: false,
      domain: config.cookieDomain,
    },
    store: new PrismaSessionStore(prisma as never, {
      checkPeriod: 2 * 60 * 1000, // Prune expired sessions every 2 minutes
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  });

  const localStrategy = new passportLocal.Strategy(
    {
      usernameField: "email",
      passwordField: "password",
      passReqToCallback: true,
      session: false,
    },
    async (
      req: { body: { email: string; password: string } },
      _email,
      _password,
      done,
    ) => {
      try {
        const account = await prisma.account.findFirst({
          where: {
            email: req.body.email.toLowerCase(),
          },
        });

        if (!account)
          return done(null, false, {
            message: "invalid-credentials",
          });

        // Verify password and TFA code
        if (!bcrypt.compareSync(req.body.password, account.password))
          return done(null, false, {
            message: "invalid-credentials",
          });

        // Check the account status
        if (account.status == "inactive")
          return done(null, false, {
            message: "account-locked",
          });

        logger.info(`Account login for ${req.body.email}`);

        return done(null, account);
      } catch (err: unknown) {
        return done(err);
      }
    },
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    const user = await prisma.account.findUnique({
      where: { id: id },
    });
    if (user == null) {
      done(null, null);
      return;
    }
    done(null, user as Express.User);
  });

  passport.use(localStrategy);

  return {
    getSessionMiddleware() {
      return sessionMiddleware;
    },
    loadToServer(server: Express) {
      server.use(sessionMiddleware);
      server.use(passport.initialize());
      server.use(passport.session());
    },
  };
}

export default createSessionManager;
