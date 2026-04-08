import { HTTP_STATUS_RANGE } from "./http";
import type { ClientDefaults } from "./types";

/**
 * Default request timeout, in milliseconds, applied to new clients.
 */
export const DEFAULT_TIMEOUT = 30_000;

/**
 * Default status validator that accepts only `2xx` responses.
 *
 * @param status - HTTP status code returned by the runtime.
 * @returns `true` when the status is considered successful.
 */
export const defaultValidateStatus = (status: number): boolean =>
  status >= HTTP_STATUS_RANGE.SUCCESS_MIN && status < HTTP_STATUS_RANGE.SUCCESS_MAX_EXCLUSIVE;

/**
 * Baseline defaults applied to every newly created client instance.
 */
export const DEFAULT_CLIENT_DEFAULTS: Readonly<
  Pick<ClientDefaults, "timeout" | "transformRequest" | "transformResponse" | "validateStatus">
> = {
  timeout: DEFAULT_TIMEOUT,
  transformRequest: [],
  transformResponse: [],
  validateStatus: defaultValidateStatus,
};
