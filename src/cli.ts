#!/usr/bin/env node

import { match } from "minimatch";
import { spawnSync } from "child_process";
import assert = require("assert");

const [, , ...globsAndVersion] = process.argv;

assert(globsAndVersion.length >= 2, "Insufficient arguments provided");

const globs = globsAndVersion.slice(0, -1);
const [version] = globsAndVersion.slice(-1);

assert(globs.length > 0, "No globs provided");
assert(version != null, "No version provided");

const cwd = process.cwd();

const versionsFoundLocally = new Map<string, string>();
const versionsFoundInRegistry = new Map<string, string>();
const namesToCheck = new Set<string>();

function runPnpm(command: string[], withStdio: boolean) {
  const result = spawnSync(`pnpm`, command, {
    env: process.env,
    cwd,
    encoding: "utf-8",
    stdio: withStdio ? "inherit" : undefined,
  });

  if (result.status === 0 && !!result.stdout) {
    return result.stdout;
  }
  return null;
}

function findInstalled() {
  const result = runPnpm(["list", "--recursive", "--json"], false);

  if (result != null) {
    return result.split("\n\n").flatMap((s) => JSON.parse(s));
  }
  return [];
}

function checkDependencies(deps: any) {
  for (const glob of globs) {
    for (const dependencyName of match(Object.keys(deps), glob)) {
      if (!versionsFoundLocally.has(dependencyName)) {
        namesToCheck.add(dependencyName);
      }
    }
  }
}

function inspectDependency(name: string, version: string) {
  const result = runPnpm(["view", `${name}@${version}`, "--json"], false);

  if (result != null) {
    const json = JSON.parse(result);

    /**
     * Only proceed if the JSON output contains a name that matches the one we queried for
     */
    if (json.name === name) {
      return json;
    }
  }
  return null;
}

console.info(`Running in ${cwd}`);

const foundPackageJsons = findInstalled();

console.group("Found packages");
for (const foundPackageJson of foundPackageJsons) {
  if (foundPackageJson == null) continue;
  if (typeof foundPackageJson !== "object") continue;
  if (typeof foundPackageJson.name !== "string") continue;
  if (typeof foundPackageJson.version !== "string") continue;

  versionsFoundLocally.set(foundPackageJson.name, foundPackageJson.version);
  console.info(`${foundPackageJson.name}: ${foundPackageJson.version}`);
}
console.groupEnd();

console.group("Found non-workspace dependencies");
for (const foundPackageJson of foundPackageJsons) {
  checkDependencies(foundPackageJson.dependencies ?? {});
  checkDependencies(foundPackageJson.devDependencies ?? {});
  checkDependencies(foundPackageJson.peerDependencies ?? {});
}
for (const name of namesToCheck) {
  console.info(name);
}
console.groupEnd();

console.group("Matching versions");
for (const dependencyName of namesToCheck) {
  const inspected = inspectDependency(dependencyName, version);

  if (inspected == null) continue;
  if (typeof inspected !== "object") continue;
  if (typeof inspected.name !== "string") continue;
  if (typeof inspected.version !== "string") continue;

  if (!versionsFoundInRegistry.has(inspected.name)) {
    versionsFoundInRegistry.set(inspected.name, inspected.version);
    console.info(`${inspected.name}: ${inspected.version}`);
  }
}
console.groupEnd();

console.info("Updating...");
const updateStrings: string[] = [];
for (const [name, version] of versionsFoundInRegistry) {
  updateStrings.push(`${name}@${version}`);
}
for (const [name, version] of versionsFoundLocally) {
  updateStrings.push(`${name}@workspace:${version}`);
}

runPnpm(["--recursive", "update", ...updateStrings], true);
