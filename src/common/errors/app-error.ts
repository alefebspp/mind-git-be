export enum ErrorCode {
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BAD_REQUEST = "BAD_REQUEST",
  UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static notFound(message: string = "Resource not found"): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  }

  static validationError(message: string = "Validation error"): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400);
  }

  static badRequest(message: string = "Bad request"): AppError {
    return new AppError(ErrorCode.BAD_REQUEST, message, 400);
  }

  static internalError(message: string = "Internal server error"): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500);
  }

  static unprocessableEntity(
    message: string = "Unprocessable entity"
  ): AppError {
    return new AppError(ErrorCode.UNPROCESSABLE_ENTITY, message, 422);
  }
}


