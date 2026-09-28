import "dotenv/config";
import net from "node:net";
import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost:5432/app_db");
const host = url.hostname;
const port = Number(url.port || 5432);
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(host);
if (isLocal) {
  const available = await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(1500);
    const finish = (ready) => { socket.destroy(); resolve(ready); };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
  if (!available) {
    const base = path.join(process.env.LOCALAPPDATA ?? "", "TraceLab");
    const executable = path.join(base, "postgresql-17.11", "pgsql", "bin", "pg_ctl.exe");
    const data = path.join(base, "data");
    if (process.platform !== "win32" || port !== 5432 || !existsSync(executable) || !existsSync(path.join(data, "PG_VERSION"))) {
      console.error("Start PostgreSQL for DATABASE_URL before running TraceLab. No existing database was changed.");
      process.exit(1);
    }
    const result = spawnSync(executable, ["start", "-D", data, "-l", path.join(base, "postgresql.log"), "-w"], { windowsHide: true, stdio: "inherit", timeout: 30000 });
    if (result.error || result.status !== 0) process.exit(1);
  }
}
