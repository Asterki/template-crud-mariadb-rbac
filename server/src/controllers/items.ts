import type { RequestHandler } from "express";

import type { ItemService } from "../services/item-service.js";
import { actorFrom } from "./shared.js";

export type ItemControllerDependencies = {
  items: ItemService;
};

export function createItemsController({ items }: ItemControllerDependencies) {
  const list: RequestHandler = async (req, res) => {
    const query = req.validated?.query as Parameters<ItemService["list"]>[0];
    res.json(await items.list(query, actorFrom(req)));
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    res.json({ data: await items.get(id) });
  };

  const create: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json({ data: await items.create(req.body, actorFrom(req)) });
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    res.json({ data: await items.update(id, req.body, actorFrom(req)) });
  };

  const remove: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    res.json({ data: await items.softDelete(id, actorFrom(req)) });
  };

  const restore: RequestHandler = async (req, res) => {
    const { id } = req.validated?.params as { id: string };
    res.json({ data: await items.restore(id, actorFrom(req)) });
  };

  return { list, get, create, update, remove, restore };
}
