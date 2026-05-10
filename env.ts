import { env as loadEnv } from "custom-env";
import { z, ZodError } from "zod";

process.env.APP_STAGE = process.env.APP_STAGE || "dev";

const isDevelopement = process.env.APP_STAGE === "dev";
const isTesting = process.env.APP_STAGE === "testing";
const isProduction = process.env.APP_STAGE === "production";

if (isDevelopement) {
  loadEnv();
} else if (isTesting) {
  loadEnv("test");
}

const EnvSchema = z.object({
  APP_STAGE: z.enum(["dev", "testing", "production"]).default("dev"),
  NODE_ENV: z
    .enum(["development", "testing", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
});

type EnvType = z.infer<typeof EnvSchema>;

export let env: EnvType;

try {
  env = EnvSchema.parse(process.env);
} catch (e) {
  if (e instanceof ZodError) {
    console.log("Invalid ENV variables");
    e.issues.forEach((err) => {
      console.log(`${err.path.join(".")} : ${err.message}`);
    });
    process.exit(1);
  }

  throw e;
}

export const isDev = () => env.NODE_ENV === "development";
export const isTest = () => env.NODE_ENV === "testing";
export const isProd = () => env.NODE_ENV === "production";
