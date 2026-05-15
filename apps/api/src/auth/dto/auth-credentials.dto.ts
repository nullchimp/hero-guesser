import { Transform } from "class-transformer";
import {
  IsString,
  Length,
  Matches,
  MinLength
} from "class-validator";
import {
  HERONAME_MAX_LENGTH,
  HERONAME_MIN_LENGTH,
  HERONAME_PATTERN,
  PASSWORD_MIN_LENGTH
} from "../auth.validation.js";

export class AuthCredentialsDto {
  @Transform(({ value }: { value: unknown }): unknown => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(HERONAME_MIN_LENGTH, HERONAME_MAX_LENGTH)
  @Matches(HERONAME_PATTERN, {
    message: "heroname can only use letters, numbers, underscores, and hyphens"
  })
  heroname!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  password!: string;
}
