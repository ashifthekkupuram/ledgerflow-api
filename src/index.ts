import app from "./server.ts";
import { env } from "../env.ts";
import { initializeRedisClient } from "./utils/redis.ts";

app.listen(env.PORT, async () => {
  await initializeRedisClient();
  console.log(`Server is running on PORT ${env.PORT}`);
});
