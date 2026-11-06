import { handle } from "hono/vercel";
import { app } from "../src/honoApp.js";

export const config = {
  runtime: "edge",
};

export default handle(app);
