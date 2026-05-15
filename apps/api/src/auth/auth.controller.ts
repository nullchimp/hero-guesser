import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards
} from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import type {
  AuthSessionResponse,
  AuthUser,
  AuthUserResponse
} from "./auth.types.js";
import { CurrentUser } from "./current-user.decorator.js";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() dto: AuthCredentialsDto): Promise<AuthSessionResponse> {
    return this.auth.register(dto);
  }

  @Post("login")
  async login(@Body() dto: AuthCredentialsDto): Promise<AuthSessionResponse> {
    return this.auth.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser): AuthUserResponse {
    return {
      user
    };
  }
}
