// Domain errors thrown by services; app.ts maps them to HTTP responses.

export class NotFound extends Error {}
export class Forbidden extends Error {}
export class Unauthorized extends Error {}
export class BadRequest extends Error {}
