import { HttpException, HttpStatus } from "@nestjs/common";

export class CanvasAuthError extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    readonly retryable: boolean
  ) {
    super(
      {
        message,
        retryable,
        statusCode: status
      },
      status
    );
  }
}
