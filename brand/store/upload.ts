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

  const ids: string[] = [];

  for (const file of readdirSync(path.join(here, "out", dir))
    .filter((f) => f.endsWith(".png"))
    .toSorted()) {
    const bytes = readFileSync(path.join(here, "out", dir, file));

    const shot = api("POST", "/v1/appScreenshots", {
      data: {
        type: "appScreenshots",
        attributes: { fileName: file, fileSize: bytes.length },
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
    ids.push(shot.id);
    console.log(`${type} ${file}`);
  }

  api("PATCH", `/v1/appScreenshotSets/${set}/relationships/appScreenshots`, {
    data: ids.map((id) => ({ type: "appScreenshots", id })),
  });
}

// Apple processes uploads after the fact; report each one's final state.
await new Promise((r) => setTimeout(r, 20_000));

const sets = api(
  "GET",
  `/v1/appStoreVersionLocalizations/${localization}/appScreenshotSets?include=appScreenshots&limit[appScreenshots]=10`,
);

for (const s of sets.included ?? []) {
  console.log(
    s.attributes.fileName,
    s.attributes.assetDeliveryState?.state,
    JSON.stringify(s.attributes.assetDeliveryState?.errors ?? []),
  );
}
