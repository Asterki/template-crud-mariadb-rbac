import type { IAccount } from "./account.js";
import type { IMetadata } from "./metadata.js";

export type IMetadataUpdateHistory = {
  id: string;
  metadataId: string;
  metadata: IMetadata;
  updatedAt: Date;
  updatedById?: string | null;
  updatedBy?: string | IAccount | null;
  changes: Record<string, unknown>;
};
