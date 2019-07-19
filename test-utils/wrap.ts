import { ChildProcess, spawn } from "child_process";
import { join } from "path";

export function wrapCommand<T extends { [key: string]: string }>(cmd: string, cwd: string, env: T) {
  let childProcess: ChildProcess;

  async function start() {
    const nodeExec = process.env.npm_node_execpath || process.execPath;
    childProcess = spawn(nodeExec, [join(__dirname, "../packages/cli/cli.js"), ...cmd.split(" ")], {
      cwd,
      env
    });
  }

  function stopped() {
    return new Promise(resolve => {
      if (childProcess == null) {
        resolve();
      }

      childProcess.on("exit", () => {
        childProcess = null;
        resolve();
      });
    });
  }

  async function stop() {
    if (childProcess == null) {
      return;
    }
    const onStopped = stopped();
    childProcess.kill();
    await onStopped;
  }

  type PipeFn<TPipe> = (msg: TPipe) => void;

  let currentOutFn: PipeFn<any>;
  let currentErrFn: PipeFn<any>;
  return {
    start,
    stop,
    async wait(forStr: string) {
      if (childProcess == null) {
        throw new Error("childProcess is null!");
      }
      return new Promise((resolve, reject) => {
        const listener = data => {
          if (data.toString().indexOf(forStr) >= 0) {
            childProcess.stdout.off("data", listener);
            resolve();
          }
        };
        childProcess.stdout.on("data", listener);
        childProcess.on("exit", code => {
          if (code !== 0) {
            reject("Exited with code " + code);
          }
        });
      });
    },
    pipe(out: PipeFn<string>, err: PipeFn<string>) {
      if (childProcess == null) {
        throw new Error("childProcess is null!");
      }

      currentOutFn = data => out(data.toString());
      currentErrFn = data => err(data.toString());
      childProcess.stdout.on("data", currentOutFn);
      childProcess.stderr.on("data", currentErrFn);
    },
    unpipe() {
      childProcess.stdout.off("data", currentOutFn);
      childProcess.stderr.off("data", currentErrFn);
    },
    stopped
  };
}
