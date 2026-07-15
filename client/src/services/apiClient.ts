
import { API_URL } from "../config/env";

const getApiBaseUrl = () => {
  return API_URL;
};

const toUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return path;
  if (typeof path !== "string") return path;
  if (!path.startsWith("/")) return path;
  return `${baseUrl}${path}`;
};

const isPlainObject = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};


export const apiRequest = async (path, options = {}) => {
  // @ts-expect-error TODO: Fix pervasive types
  const { method = "GET", body, token, headers = {}, signal, responseType = "json", keepalive } = options;

  const url = toUrl(path);

  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const init = {
    method,
    headers: requestHeaders,
    signal,
    keepalive,
  };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      // @ts-expect-error TODO: Fix pervasive types
      init.body = body;
    } else {
      requestHeaders["Content-Type"] = "application/json";
      // @ts-expect-error TODO: Fix pervasive types
      init.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    const networkError = new Error("Network error");
    // @ts-expect-error TODO: Fix pervasive types
    networkError.status = 0;
    // @ts-expect-error TODO: Fix pervasive types
    networkError.cause = cause;
    // @ts-expect-error TODO: Fix pervasive types
    networkError.url = url;
    // @ts-expect-error TODO: Fix pervasive types
    networkError.method = method;
    throw networkError;
  }

  const contentType = response.headers.get("content-type") || "";

  let data = null;
  if (response.status !== 204) {
    if (responseType === "blob") {
      try {
        data = await response.blob();
      } catch {
        data = null;
      }
    } else if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        const text = await response.text();
        data = text ? { message: text } : null;
      } catch {
        data = null;
      }
    }
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }

    const message =
      (data &&
        typeof data === "object" &&
        typeof data.message === "string" &&
        data.message) ||
      (data &&
        typeof data === "object" &&
        typeof data.detail === "string" &&
        data.detail) ||
      response.statusText ||
      "Request failed";

    const error = new Error(message);
    // @ts-expect-error TODO: Fix pervasive types
    error.status = response.status;
    // @ts-expect-error TODO: Fix pervasive types
    error.data = data;
    // @ts-expect-error TODO: Fix pervasive types
    error.errors =
      (data &&
        typeof data === "object" &&
        typeof data.errors === "object" &&
        !Array.isArray(data.errors) &&
        data.errors) ||
      {};
    // @ts-expect-error TODO: Fix pervasive types
    error.url = url;
    // @ts-expect-error TODO: Fix pervasive types
    error.method = method;

    if (typeof window !== "undefined") {
      // @ts-expect-error TODO: Fix pervasive types
      window.dispatchEvent(new CustomEvent("api:error", { detail: { message: error.message, status: error.status } }));
    }

    throw error;
  }

  return data ?? {};
};

export const normalizeApiError = (error) => {
  if (!error) {
    return {
      status: 500,
      message: "Something went wrong",
      errors: {},
      data: null,
    };
  }

  const status =
    (typeof error.status === "number" && error.status) ||
    (typeof error.response?.status === "number" && error.response.status) ||
    500;

  const data = error.data ?? error.response?.data ?? null;

  let message = "Something went wrong";
  let errors = {};

  if (data && typeof data === "object") {
    if (typeof data.message === "string" && data.message) {
      message = data.message;
    } else if (typeof data.detail === "string" && data.detail) {
      message = data.detail;
    } else if (typeof data.error === "string" && data.error) {
      message = data.error;
    }

    if (data.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
      errors = data.errors;
    }
  } else if (typeof error.message === "string" && error.message) {
    message = error.message;
  }

  return {
    status,
    message,
    errors,
    data,
  };
};
