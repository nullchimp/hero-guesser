import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";

const OUTDATED_SCHEMA_CODES = new Set([
  "P2021",
  "P2022"
]);

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (OUTDATED_SCHEMA_CODES.has(error.code)) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: "Service Unavailable",
        message: "Database schema is not up to date. Run Prisma migrations and restart the API.",
        statusCode: HttpStatus.SERVICE_UNAVAILABLE
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: "Internal Server Error",
      message: "Database request failed.",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR
    });
  }
}
