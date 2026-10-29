import { useEffect, useState } from "react";

import type { NormalizedApiError } from "../../../utils/api";
import { normalizeApiError } from "../../../utils/api";
import { docsApi, type DocManifestEntry } from "../api";

export function useDocsManifest() {
  const [data, setData] = useState<DocManifestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    docsApi
      .manifest()
      .then((entries) => {
        if (active) setData(entries);
      })
      .catch((cause: unknown) => {
        if (active) setError(normalizeApiError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return { data, loading, error, reload: () => setReloadKey((key) => key + 1) };
}
