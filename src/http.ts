/**
 * Named HTTP status-code constants.
 *
 * The names follow standard HTTP reason phrases so callers can avoid raw
 * numeric literals in control flow, validation, and tests.
 */
export const HTTP_STATUS = {
  /** `100 Continue`. */
  CONTINUE: 100,
  /** `101 Switching Protocols`. */
  SWITCHING_PROTOCOLS: 101,
  /** `102 Processing`. */
  PROCESSING: 102,
  /** `103 Early Hints`. */
  EARLY_HINTS: 103,
  /** `200 OK`. */
  OK: 200,
  /** `201 Created`. */
  CREATED: 201,
  /** `202 Accepted`. */
  ACCEPTED: 202,
  /** `203 Non-Authoritative Information`. */
  NON_AUTHORITATIVE_INFORMATION: 203,
  /** `204 No Content`. */
  NO_CONTENT: 204,
  /** `205 Reset Content`. */
  RESET_CONTENT: 205,
  /** `206 Partial Content`. */
  PARTIAL_CONTENT: 206,
  /** `207 Multi-Status`. */
  MULTI_STATUS: 207,
  /** `208 Already Reported`. */
  ALREADY_REPORTED: 208,
  /** `226 IM Used`. */
  IM_USED: 226,
  /** `300 Multiple Choices`. */
  MULTIPLE_CHOICES: 300,
  /** `301 Moved Permanently`. */
  MOVED_PERMANENTLY: 301,
  /** `302 Found`. */
  FOUND: 302,
  /** `303 See Other`. */
  SEE_OTHER: 303,
  /** `304 Not Modified`. */
  NOT_MODIFIED: 304,
  /** `305 Use Proxy`. */
  USE_PROXY: 305,
  /** `307 Temporary Redirect`. */
  TEMPORARY_REDIRECT: 307,
  /** `308 Permanent Redirect`. */
  PERMANENT_REDIRECT: 308,
  /** `400 Bad Request`. */
  BAD_REQUEST: 400,
  /** `401 Unauthorized`. */
  UNAUTHORIZED: 401,
  /** `402 Payment Required`. */
  PAYMENT_REQUIRED: 402,
  /** `403 Forbidden`. */
  FORBIDDEN: 403,
  /** `404 Not Found`. */
  NOT_FOUND: 404,
  /** `405 Method Not Allowed`. */
  METHOD_NOT_ALLOWED: 405,
  /** `406 Not Acceptable`. */
  NOT_ACCEPTABLE: 406,
  /** `407 Proxy Authentication Required`. */
  PROXY_AUTHENTICATION_REQUIRED: 407,
  /** `408 Request Timeout`. */
  REQUEST_TIMEOUT: 408,
  /** `409 Conflict`. */
  CONFLICT: 409,
  /** `410 Gone`. */
  GONE: 410,
  /** `411 Length Required`. */
  LENGTH_REQUIRED: 411,
  /** `412 Precondition Failed`. */
  PRECONDITION_FAILED: 412,
  /** `413 Payload Too Large`. */
  PAYLOAD_TOO_LARGE: 413,
  /** `414 URI Too Long`. */
  URI_TOO_LONG: 414,
  /** `415 Unsupported Media Type`. */
  UNSUPPORTED_MEDIA_TYPE: 415,
  /** `416 Range Not Satisfiable`. */
  RANGE_NOT_SATISFIABLE: 416,
  /** `417 Expectation Failed`. */
  EXPECTATION_FAILED: 417,
  /** `418 I'm a teapot`. */
  IM_A_TEAPOT: 418,
  /** `421 Misdirected Request`. */
  MISDIRECTED_REQUEST: 421,
  /** `422 Unprocessable Content`. */
  UNPROCESSABLE_CONTENT: 422,
  /** `423 Locked`. */
  LOCKED: 423,
  /** `424 Failed Dependency`. */
  FAILED_DEPENDENCY: 424,
  /** `425 Too Early`. */
  TOO_EARLY: 425,
  /** `426 Upgrade Required`. */
  UPGRADE_REQUIRED: 426,
  /** `428 Precondition Required`. */
  PRECONDITION_REQUIRED: 428,
  /** `429 Too Many Requests`. */
  TOO_MANY_REQUESTS: 429,
  /** `431 Request Header Fields Too Large`. */
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  /** `451 Unavailable For Legal Reasons`. */
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  /** `500 Internal Server Error`. */
  INTERNAL_SERVER_ERROR: 500,
  /** `501 Not Implemented`. */
  NOT_IMPLEMENTED: 501,
  /** `502 Bad Gateway`. */
  BAD_GATEWAY: 502,
  /** `503 Service Unavailable`. */
  SERVICE_UNAVAILABLE: 503,
  /** `504 Gateway Timeout`. */
  GATEWAY_TIMEOUT: 504,
  /** `505 HTTP Version Not Supported`. */
  HTTP_VERSION_NOT_SUPPORTED: 505,
  /** `506 Variant Also Negotiates`. */
  VARIANT_ALSO_NEGOTIATES: 506,
  /** `507 Insufficient Storage`. */
  INSUFFICIENT_STORAGE: 507,
  /** `508 Loop Detected`. */
  LOOP_DETECTED: 508,
  /** `510 Not Extended`. */
  NOT_EXTENDED: 510,
  /** `511 Network Authentication Required`. */
  NETWORK_AUTHENTICATION_REQUIRED: 511,
} as const;

/**
 * Union of supported HTTP status-code constants.
 */
export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

/**
 * Inclusive and exclusive bounds for HTTP status classes.
 */
export const HTTP_STATUS_RANGE = {
  /** Inclusive lower bound for informational responses. */
  INFORMATIONAL_MIN: 100,
  /** Exclusive upper bound for informational responses. */
  INFORMATIONAL_MAX_EXCLUSIVE: 200,
  /** Inclusive lower bound for successful responses. */
  SUCCESS_MIN: 200,
  /** Exclusive upper bound for successful responses. */
  SUCCESS_MAX_EXCLUSIVE: 300,
  /** Inclusive lower bound for redirection responses. */
  REDIRECTION_MIN: 300,
  /** Exclusive upper bound for redirection responses. */
  REDIRECTION_MAX_EXCLUSIVE: 400,
  /** Inclusive lower bound for client-error responses. */
  CLIENT_ERROR_MIN: 400,
  /** Exclusive upper bound for client-error responses. */
  CLIENT_ERROR_MAX_EXCLUSIVE: 500,
  /** Inclusive lower bound for server-error responses. */
  SERVER_ERROR_MIN: 500,
  /** Exclusive upper bound for server-error responses. */
  SERVER_ERROR_MAX_EXCLUSIVE: 600,
} as const;
