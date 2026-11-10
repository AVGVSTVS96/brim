// Puts brand/store/out/ on the App Store listing, replacing whatever screenshots each size had.
// API calls go through the App Store Connect key on the Mac: `ssh mac ruby ~/.appstoreconnect/asc.rb`.
// Usage: bun store/upload.ts <appStoreVersionLocalization id>
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const localization = process.argv[2];

if (!localization) throw new Error("usage: bun store/upload.ts <appStoreVersionLocalization id>");

const here = import.meta.dirname;
const sizes: Record<string, { type: string }> = JSON.parse(readFileSync(path.join(here, "out/sizes.json"), "utf8"));

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const api = (method: string, url: string, body?: Json) => {
  const json =
    body === undefined ? "" : ` "$(echo ${Buffer.from(JSON.stringify(body)).toString("base64")} | base64 -d)"`;

  const run = () =>
    execFileSync("ssh", ["mac", `ruby ~/.appstoreconnect/asc.rb ${method} '${url}'${json}`], { encoding: "utf8" });

  let res = "";

  // The Mac's connection to Apple times out now and then, and ssh drops; a network error is worth more tries.
  for (let attempt = 1; ; attempt++) {
    try {
      res = run();
      break;
    } catch (error) {
      const dropped = error instanceof Error && "status" in error && error.status === 255;
      const timedOut = error instanceof Error && "stderr" in error && String(error.stderr).includes("Timeout");

      if (attempt === 4 || !(dropped || timedOut)) throw error;
      execFileSync("sleep", ["5"]);
    }
  }

  const [status, ...rest] = res.split("\n");
  const text = rest.join("\n").trim();

  if (!status.startsWith("2")) throw new Error(`${method} ${url}: ${status} ${text}`);

  return text ? JSON.parse(text) : null;
};

const ref = (type: string, id: string) => ({ data: { type, id } });

const upload = async (set: string, file: string) => {
  const bytes = readFileSync(file);

  const shot = api("POST", "/v1/appScreenshots", {
    data: {
      type: "appScreenshots",
      attributes: { fileName: path.basename(file), fileSize: bytes.length },
      relationships: { appScreenshotSet: ref("appScreenshotSets", set) },
    },
  }).data;

  for (const op of shot.attributes.uploadOperations) {
    const headers = Object.fromEntries(
      op.requestHeaders.map((h: { name: string; value: string }) => [h.name, h.value]),
    );

    const res = await fetch(op.url, {
      method: op.method,
      headers,
      body: bytes.subarray(op.offset, op.offset + op.length),
    });

    if (!res.ok) throw new Error(`upload ${file}: ${res.status} ${await res.text()}`);
  }

  api("PATCH", `/v1/appScreenshots/${shot.id}`, {
    data: {
      type: "appScreenshots",
      id: shot.id,
      attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") },
    },
  });

  return String(shot.id);
};

// Waits up to three minutes for Apple to process each upload; returns the files it didn't.
const unprocessed = async (shots: [string, string][]) => {
  let waiting = shots;

  for (let tick = 0; tick < 18 && waiting.length > 0; tick++) {
    await new Promise((r) => setTimeout(r, 10_000));
    waiting = waiting.filter(([file, id]) => {
      const state = api("GET", `/v1/appScreenshots/${id}`).data.attributes.assetDeliveryState;

      if (state.state === "FAILED") console.log(`${file} failed: ${JSON.stringify(state.errors)}`);

      return state.state !== "COMPLETE";
    });
  }

  return waiting.map(([file]) => file);
};

for (const [dir, { type }] of Object.entries(sizes)) {
  const sets = api(
    "GET",
    `/v1/appStoreVersionLocalizations/${localization}/appScreenshotSets?filter[screenshotDisplayType]=${type}`,
  );

  let set: string = sets.data[0]?.id;

  if (set) {
    for (const old of api("GET", `/v1/appScreenshotSets/${set}/appScreenshots`).data)
      api("DELETE", `/v1/appScreenshots/${old.id}`);
  } else {
    set = api("POST", "/v1/appScreenshotSets", {
      data: {
        type: "appScreenshotSets",
        attributes: { screenshotDisplayType: type },
        relationships: { appStoreVersionLocalization: ref("appStoreVersionLocalizations", localization) },
      },
    }).data.id;
  }

  const files = readdirSync(path.join(here, "out", dir))
    .filter((f) => f.endsWith(".png"))
    .toSorted();

  const ids = new Map<string, string>();

  // Apple leaves some uploads at UPLOAD_COMPLETE without ever processing them; those go up again.
  let pending = files;

  for (let round = 1; pending.length > 0; round++) {
    if (round > 4) throw new Error(`${type}: Apple never processed ${pending.join(", ")}`);

    for (const file of pending) {
      const stale = ids.get(file);

      if (stale) api("DELETE", `/v1/appScreenshots/${stale}`);
      ids.set(file, await upload(set, path.join(here, "out", dir, file)));
      console.log(`${type} ${file}`);
    }

    pending = await unprocessed(pending.map((file) => [file, ids.get(file) ?? ""]));
  }

  // A screenshot just deleted lingers in the set for a moment, and Apple refuses the reorder until it's gone.
  for (let attempt = 1; ; attempt++) {
    try {
      api("PATCH", `/v1/appScreenshotSets/${set}/relationships/appScreenshots`, {
        data: files.map((file) => ({ type: "appScreenshots", id: ids.get(file) ?? "" })),
      });
      break;
    } catch (error) {
      if (attempt === 12 || !String(error).includes("409")) throw error;
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}
