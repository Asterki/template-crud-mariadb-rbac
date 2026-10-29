import type { Express } from "express";
import passport from "passport";
import passportLocal from "passport-local";
import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";

import type { AppConfig } from "../config/index.js";
import { sessionCookieName, sessionCookieOptions } from "../http/cookies.js";

const BCRYPT_COST = 12;

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
    name: sessionCookieName(config),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: sessionCookieOptions(config),
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
    },
    async (email, password, done) => {
      try {
        const account = await prisma.account.findFirst({
          where: { email: email.trim().toLowerCase() },
          include: { metadata: { select: { deleted: true } } },
        });

        if (!account) {
          return done(null, false, { message: "invalid-credentials" });
        }

        const valid = await bcrypt.compare(password, account.password);
        if (!valid) {
          return done(null, false, { message: "invalid-credentials" });
        }

        if (
          account.status === "inactive" ||
          account.metadata?.deleted === true
        ) {
          return done(null, false, { message: "account-locked" });
        }

        if (bcrypt.getRounds(account.password) !== BCRYPT_COST) {
          const rehashed = await bcrypt.hash(password, BCRYPT_COST);
          await prisma.account.update({
            where: { id: account.id },
            data: { password: rehashed },
          });
          account.password = rehashed;
        }

        logger.info({ accountId: account.id }, "Account login");
        return done(null, account);
      } catch (error) {
        return done(error);
      }
    },
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.account.findUnique({
        where: { id },
        include: { metadata: { select: { deleted: true } } },
      });
      if (
        user === null ||
        user.status === "inactive" ||
        user.metadata?.deleted === true
      ) {
        done(null, false);
        return;
      }
      done(null, user as Express.User);
    } catch (error) {
      done(error);
    }
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
