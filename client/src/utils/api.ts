import axios, { type AxiosRequestConfig } from "axios";

export type NormalizedApiError = {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
};

export class ApiRequestError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status?: number;

  constructor({ code, message, details, status }: NormalizedApiError) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

const client = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

let csrfToken: string | null = null;
let csrfPending: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfPending) {
    csrfPending = client
      .get<{ csrfToken: string }>("/auth/csrf")
      .then((response) => {
        csrfToken = response.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfPending = null;
      });
  }
  return csrfPending;
}

client.interceptors.request.use(async (config) => {
  const method = (config.method ?? "get").toLowerCase();
  if (UNSAFE_METHODS.has(method)) {
    const token = await getCsrfToken();
    config.headers.set("x-csrf-token", token);
  }
  return config;
});

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (error instanceof ApiRequestError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      status: error.status,
    };
  }

  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { error?: { code?: string; message?: string; details?: unknown } }
      | undefined;

    if (payload?.error?.code) {
      return {
        code: payload.error.code,
        message: payload.error.message ?? payload.error.code,
        details: payload.error.details,
        status: error.response?.status,
      };
    }

    if (error.response) {
      return {
        code: "internal-error",
        message: "internal-error",
        status: error.response.status,
      };
    }

    return { code: "network-error", message: "network-error" };
  }

  return { code: "internal-error", message: "internal-error" };
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await client.request<T>(config);
    return response.data;
  } catch (error) {
    throw new ApiRequestError(normalizeApiError(error));
  }
}

export const api = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return request<T>({ ...config, method: "get", url });
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return request<T>({ ...config, method: "post", url, data });
  },
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return request<T>({ ...config, method: "patch", url, data });
  },
  delete<T>(url: string, config?: AxiosRequestConfig) {
    return request<T>({ ...config, method: "delete", url });
  },
};

/** Reset after auth changes so the next unsafe request fetches a token again. */
export function resetCsrfToken(): void {
  csrfToken = null;
  csrfPending = null;
}
