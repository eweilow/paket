import chalk from "chalk";
import detectNewline from "detect-newline";
import { readFileSync, writeFileSync } from "fs";
import * as glob from "glob";
import * as minimatch from "minimatch";
import fetch from "node-fetch";
import * as path from "path";

type Mode = "any" | "latest";
type OperationMode = "update" | "check";

const cache = new Map<string, any>();
async function getLatest(packageName: string) {
  if (cache.has(packageName)) {
    return cache.get(packageName);
  }

  const url = new URL(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
  ).href;

  const res = await fetch(url);
  const json = await res.json();
  cache.set(packageName, json);
  return json;
}

function isPackageMatch(name: string, globs: minimatch.IMinimatch[]) {
  return globs.some(el => el.match(name));
}

function readMatchingPackages(
  globs: minimatch.IMinimatch[],
  deps: any,
  fetchNames: Set<string>
) {
  if (deps == null) {
    return;
  }

  for (const dep in deps) {
    if (isPackageMatch(dep, globs)) {
      fetchNames.add(dep);
    }
  }
}

function selectLastVersion(versions: any, times: any) {
  const sorted = versions.sort((a: string, b: string) => {
    return +new Date(times[b]) - +new Date(times[a]);
  });

  return sorted;
}

async function updateMatchingPackages(
  actuallyUpdate: boolean,
  mode: Mode,
  globs: minimatch.IMinimatch[],
  deps: any,
  prefix: string,
  type: string
): Promise<string[]> {
  if (deps == null) {
    return [];
  }

  const changed: string[] = [];

  for (const dep in deps) {
    if (isPackageMatch(dep, globs)) {
      const packageInfo = await getLatest(dep);

      const oldVersion = deps[dep];
      let newVersion: string;

      if (mode === "latest") {
        newVersion = prefix + packageInfo["dist-tags"].latest;
      } else {
        const sortedVersions = selectLastVersion(
          Object.keys(packageInfo.versions),
          packageInfo.time
        );
        newVersion = prefix + sortedVersions[0];
      }

      if (oldVersion !== newVersion) {
        // tslint:disable-next-line:no-console
        changed.push(
          `${dep} (${chalk.magenta(type)}): ${chalk.yellow(
            oldVersion
          )} -> ${chalk.green(newVersion)}`
        );

        if (actuallyUpdate) {
          deps[dep] = newVersion;
        }
      }
    }
  }
  return changed;
}

async function main(mode: Mode, op: OperationMode, ...globs: string[]) {
  const cwd = process.cwd();
  console.log("Using root folder: %s", cwd);
  let updatePrefix: string;
  switch (op) {
    case "check":
      updatePrefix = "Checking";
      break;
    case "update":
      updatePrefix = "Updating";
      break;
    default:
      throw new Error("Unknown operation: " + op);
  }
  switch (mode) {
    case "any":
      // tslint:disable-next-line:no-console
      console.log("\n%s packages matching globs:", updatePrefix);
      for (const g of globs) {
        // tslint:disable-next-line:no-console
        console.log(` - ${chalk.yellow(g)}`);
      }
      // tslint:disable-next-line:no-console
      console.log("to the last published version.\n");
      break;
    case "latest":
      // tslint:disable-next-line:no-console
      console.log("\n%s packages matching globs:", updatePrefix);
      for (const g of globs) {
        // tslint:disable-next-line:no-console
        console.log(` - ${chalk.yellow(g)}`);
      }
      // tslint:disable-next-line:no-console
      console.log("to the latest version.\n");
      break;
    default:
      throw new Error("Unknown mode: " + mode);
  }
  const files = glob
    .sync("**/package.json", {
      ignore: [
        "old/**",
        "OLD_DO_NOT_USE/**",
        "update-excitare/**",
        "node_modules/**",
        "**/node_modules/**",
        ".git/**"
      ],
      cwd
    })
    .map(name => path.join(cwd, name));

  const mappedGlobs = globs.map(el => new minimatch.Minimatch(el));

  const packages = new Map<string, any>();
  const fetchNames = new Set<string>();
  for (const file of files) {
    // tslint:disable-next-line:no-var-requires
    const pkg = require(file);
    packages.set(file, pkg);
    readMatchingPackages(mappedGlobs, pkg.dependencies, fetchNames);
    readMatchingPackages(mappedGlobs, pkg.devDependencies, fetchNames);
    readMatchingPackages(mappedGlobs, pkg.peerDependencies, fetchNames);
  }
  await Promise.all([...fetchNames].map(name => getLatest(name)));

  let someChanged = false;
  for (const [file, pkg] of packages) {
    const changed: string[] = [];
    changed.push(
      ...(await updateMatchingPackages(
        op === "update",
        mode,
        mappedGlobs,
        pkg.dependencies,
        "",
        "normal"
      ))
    );
    changed.push(
      ...(await updateMatchingPackages(
        op === "update",
        mode,
        mappedGlobs,
        pkg.devDependencies,
        "^",
        "dev"
      ))
    );
    changed.push(
      ...(await updateMatchingPackages(
        op === "update",
        mode,
        mappedGlobs,
        pkg.peerDependencies,
        "^",
        "peer"
      ))
    );
    if (changed.length > 0) {
      someChanged = true;
      const changedSet = new Set(changed);
      // tslint:disable-next-line:no-console
      console.log(`${chalk.cyan(pkg.name)}:`);
      for (const changedPkg of changedSet) {
        // tslint:disable-next-line:no-console
        console.log("  " + changedPkg);
      }
    }

    if (op === "update") {
      const existing = readFileSync(file).toString("utf-8");
      const endings = detectNewline(existing);

      if (endings != null) {
        const newData = JSON.stringify(pkg, null, "  ") + endings;
        if (newData !== existing) {
          writeFileSync(file, newData.replace(/\r?\n/g, endings));
        }
      }
    }
  }

  if (!someChanged) {
    console.log("No updates required.");
  }
  console.log("");
}

main(
  (process.argv[3] as any) as Mode,
  (process.argv[2] as any) as OperationMode,
  ...process.argv.slice(4)
).catch(err => {
  console.error(err);
  process.exit(1);
});
