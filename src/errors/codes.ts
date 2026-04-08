/**
 * Enumerates the stable error codes emitted by the client.
 */
export const ERROR_CODES = {
  /** Request URL could not be parsed or resolved into a valid URL. */
  ERR_INVALID_URL: "ERR_INVALID_URL",
  /** Caller-provided configuration is invalid or internally inconsistent. */
  ERR_INVALID_CONFIG: "ERR_INVALID_CONFIG",
  /** Native fetch failed before a response was received. */
  ERR_NETWORK: "ERR_NETWORK",
  /** Request exceeded the configured timeout before completion. */
  ERR_TIMEOUT: "ERR_TIMEOUT",
  /** Request was aborted by the caller or cancellation flow. */
  ERR_CANCELED: "ERR_CANCELED",
  /** Request failed with a client-side HTTP status validation error. */
  ERR_BAD_REQUEST: "ERR_BAD_REQUEST",
  /** Response failed with a server-side HTTP status validation error. */
  ERR_BAD_RESPONSE: "ERR_BAD_RESPONSE",
  /** Response body could not be parsed using the selected response type. */
  ERR_PARSE_RESPONSE: "ERR_PARSE_RESPONSE",
} as const;

/**
 * Union of all supported client error codes.
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
