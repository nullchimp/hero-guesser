import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AppConfigModule } from "../config/app-config.module.js";
import { AppConfigService } from "../config/app-config.service.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [
        AppConfigModule
      ],
      inject: [
        AppConfigService
      ],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: {
          expiresIn: config.jwtExpiresIn
        }
      })
    })
  ],
  controllers: [
    AuthController
  ],
  providers: [
    AuthRepository,
    AuthService,
    JwtAuthGuard
  ],
  exports: [
    JwtModule,
    JwtAuthGuard
  ]
})
export class AuthModule {}
