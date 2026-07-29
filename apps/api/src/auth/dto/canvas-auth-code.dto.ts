import { IsString, Matches } from "class-validator";

export class CanvasAuthCodeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code!: string;
}
