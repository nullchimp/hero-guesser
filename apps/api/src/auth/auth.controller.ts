import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
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
import { CanvasAuthCodeDto } from "./dto/canvas-auth-code.dto.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import {
  CanvasAuthService,
  CanvasBootstrapResponse
} from "./canvas-auth.service.js";
import { CanvasAuthError } from "./canvas-auth.error.js";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly canvasAuth: CanvasAuthService
  ) {}

  @Post("register")
  async register(@Body() dto: AuthCredentialsDto): Promise<AuthSessionResponse> {
    return this.auth.register(dto);
  }

  @Post("login")
  async login(@Body() dto: AuthCredentialsDto): Promise<AuthSessionResponse> {
    return this.auth.login(dto);
  }

  @Post("canvas/bootstrap")
  @HttpCode(HttpStatus.OK)
  async createCanvasBootstrap(
    @Headers("origin") origin: string | undefined,
    @Ip() source: string
  ): Promise<CanvasBootstrapResponse> {
    if (origin !== undefined) {
      throw new CanvasAuthError(
        "Canvas bootstrap requests cannot originate from a browser.",
        HttpStatus.FORBIDDEN,
        false
      );
    }

    return this.canvasAuth.createBootstrap(source);
  }

  @Post("canvas/exchange")
  @HttpCode(HttpStatus.OK)
  async exchangeCanvasCode(@Body() dto: CanvasAuthCodeDto): Promise<AuthSessionResponse> {
    return this.canvasAuth.exchange(dto.code);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser): AuthUserResponse {
    return {
      user
    };
  }
}
