import { config } from "dotenv";
import net from "node:net";
import path from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

function refuse() {
  console.error("Start PostgreSQL for DATABASE_URL or configure valid existing LOCAL_POSTGRES_BIN, LOCAL_POSTGRES_DATA and LOCAL_POSTGRES_LOG paths. No database was initialized or changed.");
  process.exit(1);
}
let url;
try { url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost:5432/app_db"); }
catch { refuse(); }
const host = url.hostname;
const port = Number(url.port || 5432);
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(host);
if (isLocal) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) refuse();
  const loopback = host === "[::1]" ? "::1" : "127.0.0.1";
  const available = await new Promise((resolve) => {
    const socket = net.createConnection({ host: host === "[::1]" ? "::1" : host, port });
    socket.setTimeout(1500);
    const finish = (ready) => { socket.destroy(); resolve(ready); };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
  if (!available) {
    const base = path.join(process.env.LOCALAPPDATA ?? "", "TraceLab");
    const explicit = [process.env.LOCAL_POSTGRES_BIN, process.env.LOCAL_POSTGRES_DATA, process.env.LOCAL_POSTGRES_LOG];
    const configured = explicit.some(value => value !== undefined);
    const [bin, data, log] = configured ? explicit : [path.join(base, "postgresql-17.11", "pgsql", "bin"), path.join(base, "data"), path.join(base, "postgresql.log")];
    if (process.platform !== "win32" || (!configured && port !== 5432)
      || ![bin, data, log].every(value => typeof value === "string" && path.isAbsolute(value))) refuse();
    const executable = path.join(bin, "pg_ctl.exe");
    try {
      if (!statSync(bin).isDirectory() || !statSync(data).isDirectory() || !statSync(executable).isFile()
        || !statSync(path.dirname(log)).isDirectory() || (existsSync(log) && !statSync(log).isFile())
        || !/^[1-9]\d*$/.test(readFileSync(path.join(data, "PG_VERSION"), "utf8").trim())) refuse();
    } catch { refuse(); }
    const result = spawnSync(executable, ["start", "-D", data, "-l", log, "-o", `-h ${loopback} -p ${port}`, "-w"], { windowsHide: true, stdio: "inherit", timeout: 30000 });
    if (result.error || result.status !== 0) process.exit(1);
  }
}
