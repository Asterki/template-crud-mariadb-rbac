import type { DataResponse, Paginated } from "../dto/pagination.js";
import type {
  CreateItemRequest,
  ItemStatus,
  ListItemsQuery,
  UpdateItemRequest,
} from "../schemas/items.js";

export type {
  CreateItemRequest,
  ItemStatus,
  ListItemsQuery,
  UpdateItemRequest,
};

export type ItemDto = {
  id: string;
  name: string;
  description: string | null;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
};

export type ItemResponse = DataResponse<ItemDto>;
export type ItemListResponse = Paginated<ItemDto>;
