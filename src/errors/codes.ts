/**
 * Enumerates the stable error codes emitted by the client.
 */
export const ERROR_CODES = {
  ERR_INVALID_URL: "ERR_INVALID_URL",
  ERR_INVALID_CONFIG: "ERR_INVALID_CONFIG",
  ERR_NETWORK: "ERR_NETWORK",
  ERR_TIMEOUT: "ERR_TIMEOUT",
  ERR_CANCELED: "ERR_CANCELED",
  ERR_BAD_REQUEST: "ERR_BAD_REQUEST",
  ERR_BAD_RESPONSE: "ERR_BAD_RESPONSE",
  ERR_PARSE_RESPONSE: "ERR_PARSE_RESPONSE",
} as const;

/**
 * Union of all supported client error codes.
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
