import { useEffect, useState } from "react";

import type { NormalizedApiError } from "../../../utils/api";
import { normalizeApiError } from "../../../utils/api";
import { docsApi, type DocPage } from "../api";

export function useDoc(slug: string | null) {
  const [data, setData] = useState<DocPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!slug) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    docsApi
      .get(slug)
      .then((page) => {
        if (active) setData(page);
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
  }, [slug, reloadKey]);

  return { data, loading, error, reload: () => setReloadKey((key) => key + 1) };
}
