
import { describe, expect, it } from "vitest";
import { normalizeApiError } from "../apiClient";

describe("normalizeApiError", () => {
  it("keeps plain-text error responses as the message", () => {
    const error = new Error("Request failed");
    // @ts-expect-error TODO: Fix pervasive types
    error.status = 401;
    // @ts-expect-error TODO: Fix pervasive types
    error.data = { message: "Unauthorized" };

    expect(normalizeApiError(error)).toMatchObject({
      status: 401,
      message: "Unauthorized",
      errors: {},
    });
  });

  it("prefers FastAPI detail messages over the generic fallback", () => {
    const error = {
      status: 422,
      response: {
        data: {
          detail: "Invalid request payload",
        },
      },
    };

    expect(normalizeApiError(error)).toMatchObject({
      status: 422,
      message: "Invalid request payload",
      errors: {},
    });
  });

  it("extracts field errors from the standardized schema", () => {
    const error = {
      status: 400,
      response: {
        data: {
          errors: {
            title: "Title is required",
            skills: "At least one skill is required",
          },
          message: "Validation failed",
        },
      },
    };

    expect(normalizeApiError(error)).toMatchObject({
      status: 400,
      message: "Validation failed",
      errors: {
        title: "Title is required",
        skills: "At least one skill is required",
      },
    });
  });

});