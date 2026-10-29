import type { RequestHandler } from "express";

import type { AccountService } from "../services/account-service.js";
import { actorFrom } from "./shared.js";

export type AccountControllerDependencies = {
  accounts: AccountService;
};

export function createAccountsController({
  accounts,
}: AccountControllerDependencies) {
  const list: RequestHandler = async (req, res) => {
    const query = req.validated?.query as Parameters<AccountService["list"]>[0];
    res.json(await accounts.list(query));
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    res.json({ data: await accounts.get(id) });
  };

  const create: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json({ data: await accounts.create(req.body, actorFrom(req)) });
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    res.json({
      data: await accounts.update(id, req.body, actorFrom(req)),
    });
  };

  const setStatus: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    const { status } = req.body as { status: "active" | "inactive" };
    res.json({ data: await accounts.setStatus(id, status, actorFrom(req)) });
  };

  const setPassword: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    const { newPassword } = req.body as { newPassword: string };
    res.json({
      data: await accounts.setPassword(id, newPassword, actorFrom(req)),
    });
  };

  const remove: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    res.json({ data: await accounts.softDelete(id, actorFrom(req)) });
  };

  const restore: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    res.json({ data: await accounts.restore(id, actorFrom(req)) });
  };

  return { list, get, create, update, setStatus, setPassword, remove, restore };
}
