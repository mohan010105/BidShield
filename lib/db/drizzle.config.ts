import { defineConfig } from "drizzle-kit";
import path from "path";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

let cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, "");
const match = cleanUrl.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?(\/.*)?$/);
if (match) {
  let pass = match[2];
  if (pass.startsWith("[") && pass.endsWith("]")) {
    pass = pass.slice(1, -1);
  }
  cleanUrl = `postgresql://${match[1]}:${encodeURIComponent(decodeURIComponent(pass))}@${match[3]}${match[4] ? `:${match[4]}` : ""}${match[5] || "/postgres"}`;
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: cleanUrl,
  },
});

