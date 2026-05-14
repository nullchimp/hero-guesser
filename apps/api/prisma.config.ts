import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({
  path: "../../.env"
});
config();

const databaseUrl = process.env.DATABASE_URL ?? "mysql://hero:hero_password@localhost:3306/hero_guesser";
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: databaseUrl
  }
});
