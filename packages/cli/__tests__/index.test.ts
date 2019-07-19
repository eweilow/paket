import express from "express";
import { promises } from "fs";
import { Server } from "http";
import { join } from "path";
import { DirectoryResult, dir } from "tmp-promise";

import { wrapCommand } from "../../../test-utils/wrap";

describe("CLI", () => {
  let server: Server;
  beforeAll(() => {
    const app = express();
    app.use(express.static(join(__dirname, "./version-mocks"), { index: "index.json" }));
    server = app.listen(1234);
  });

  afterAll(cb => {
    server.close(cb);
  });

  let tmpDir: DirectoryResult;
  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });
  });

  afterEach(async () => {
    tmpDir.cleanup();
  });

  function stringifyAndSplit(data: string[], ...filters: string[]) {
    const msgs = data
      .join("\n")
      .split(/\n|\r\n/g)
      .map(el => el.trim())
      .filter(el => !!el)
      .filter(el => !filters.find(filter => el.includes(filter)));
    return msgs;
  }

  async function run(cmd: string) {
    const start = wrapCommand(cmd, tmpDir.path, {
      PAKET_REGISTRY: "http://localhost:1234"
    });

    await start.start();
    const out: string[] = [];
    const err: string[] = [];
    start.pipe(
      m => !m.includes("Using root folder") && out.push(m),
      m => !m.includes("Using root folder") && err.push(m)
    );
    await start.wait("Using registry");
    await start.stopped();

    expect(stringifyAndSplit(out)).toMatchSnapshot("stdout");
    expect(stringifyAndSplit(err)).toMatchSnapshot("stderr");
  }

  describe("uses any mode", () => {
    it("runs correctly with no package.json", async () => {
      await run("update any @types/node @types/jest");
    });

    it("runs correctly with empty package.json", async () => {
      await promises.writeFile(
        join(tmpDir.path, "./package.json"),
        JSON.stringify(
          {
            name: "pkg-name",
            dependencies: {},
            devDependencies: {},
            optionalDependencies: {},
            resolutions: {},
            resolveModules: []
          },
          null,
          "  "
        )
      );
      await run("update any @types/node @types/jest");
    });

    it("runs correctly with dependencies in package.json", async () => {
      await promises.writeFile(
        join(tmpDir.path, "./package.json"),
        JSON.stringify(
          {
            name: "pkg-name",
            dependencies: { "@types/node": "1.0.0", "@types/jest": "^1.0.0" },
            devDependencies: { "@types/node": "0.1.0", "@types/jest": "^5.0.0" },
            optionalDependencies: { "@types/node": "1.1.0", "@types/jest": "^1.0.5" },
            resolutions: { "**/@types/node": "1.0.1", "**/@types/jest": "1.0.3" },
            resolveModules: []
          },
          null,
          "  "
        )
      );
      await run("update any @types/node @types/jest");
    });

    it("runs resolutions correctly", async () => {
      await promises.writeFile(
        join(tmpDir.path, "./package.json"),
        JSON.stringify(
          {
            name: "pkg-name",
            dependencies: { "@types/node": "1.0.0", "@types/jest": "^1.0.0" },
            devDependencies: { "@types/node": "0.1.0", "@types/jest": "^5.0.0" },
            optionalDependencies: { "@types/node": "1.1.0", "@types/jest": "^1.0.5" },
            resolutions: { "**/@types/node": "1.0.1", "**/@types/jest": "^1.0.3" },
            resolveModules: ["@types/node"]
          },
          null,
          "  "
        )
      );
      await run("update any @types/node @types/jest");
    });
  });

  describe("uses latest mode", () => {
    it("runs correctly with no package.json", async () => {
      await run("update latest @types/node @types/jest");
    });

    it("runs correctly with empty package.json", async () => {
      await promises.writeFile(
        join(tmpDir.path, "./package.json"),
        JSON.stringify(
          {
            name: "pkg-name",
            dependencies: {},
            devDependencies: {},
            optionalDependencies: {},
            resolutions: {},
            resolveModules: []
          },
          null,
          "  "
        )
      );
      await run("update latest @types/node @types/jest");
    });

    it("runs correctly with dependencies in package.json", async () => {
      await promises.writeFile(
        join(tmpDir.path, "./package.json"),
        JSON.stringify(
          {
            name: "pkg-name",
            dependencies: { "@types/node": "1.0.0", "@types/jest": "^1.0.0" },
            devDependencies: { "@types/node": "0.1.0", "@types/jest": "^5.0.0" },
            optionalDependencies: { "@types/node": "1.1.0", "@types/jest": "^1.0.5" },
            resolutions: { "**/@types/node": "1.0.1", "**/@types/jest": "1.0.3" },
            resolveModules: []
          },
          null,
          "  "
        )
      );
      await run("update latest @types/node @types/jest");
    });

    it("runs resolutions correctly", async () => {
      await promises.writeFile(
        join(tmpDir.path, "./package.json"),
        JSON.stringify(
          {
            name: "pkg-name",
            dependencies: { "@types/node": "1.0.0", "@types/jest": "^1.0.0" },
            devDependencies: { "@types/node": "0.1.0", "@types/jest": "^5.0.0" },
            optionalDependencies: { "@types/node": "1.1.0", "@types/jest": "^1.0.5" },
            resolutions: { "**/@types/node": "1.0.1", "**/@types/jest": "^1.0.3" },
            resolveModules: ["@types/node"]
          },
          null,
          "  "
        )
      );
      await run("update latest @types/node @types/jest");
    });
  });
});
