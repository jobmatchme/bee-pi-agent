/**
 * Adapted from vendor/pi-mono/packages/mom/src/sandbox.ts.
 *
 * Changes:
 * - executor is created relative to a working directory
 * - docker execution uses `docker exec -w`
 * - optional docker-visible workspace root can be configured
 */

import { spawn } from "child_process";

export type SandboxConfig = { type: "host" } | { type: "docker"; container: string; workspaceRoot: string };

export function parseSandboxArg(value: string, workspaceRoot = "/workspace"): SandboxConfig {
	if (value === "host") {
		return { type: "host" };
	}
	if (value.startsWith("docker:")) {
		const container = value.slice("docker:".length);
		if (!container) {
			throw new Error("docker sandbox requires container name (e.g. docker:agent-worker)");
		}
		return { type: "docker", container, workspaceRoot };
	}
	throw new Error(`Invalid sandbox type '${value}'. Use 'host' or 'docker:<container-name>'`);
}

export async function validateSandbox(config: SandboxConfig): Promise<void> {
	if (config.type === "host") return;

	await execSimple("docker", ["--version"]);
	const result = await execSimple("docker", ["inspect", "-f", "{{.State.Running}}", config.container]);
	if (result.trim() !== "true") {
		throw new Error(`Container '${config.container}' is not running`);
	}
}

function execSimple(cmd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (d) => {
			stdout += d;
		});
		child.stderr?.on("data", (d) => {
			stderr += d;
		});
		child.on("close", (code) => {
			if (code === 0) resolve(stdout);
			else reject(new Error(stderr || `Exit code ${code}`));
		});
	});
}

export function createExecutor(config: SandboxConfig, hostWorkingDir: string, dockerWorkingDir: string): Executor {
	if (config.type === "host") {
		return new HostExecutor(hostWorkingDir);
	}
	return new DockerExecutor(config.container, dockerWorkingDir, config.workspaceRoot);
}

export interface Executor {
	exec(command: string, options?: ExecOptions): Promise<ExecResult>;
	getWorkspacePath(hostPath: string): string;
}

export interface ExecOptions {
	timeout?: number;
	signal?: AbortSignal;
}

export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
}

class HostExecutor implements Executor {
	constructor(private cwd: string) {}

	async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
		return new Promise((resolve, reject) => {
			const shell = process.platform === "win32" ? "cmd" : "sh";
			const shellArgs = process.platform === "win32" ? ["/c"] : ["-c"];

			const child = spawn(shell, [...shellArgs, command], {
				cwd: this.cwd,
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";
			let timedOut = false;

			const timeoutHandle =
				options?.timeout && options.timeout > 0
					? setTimeout(() => {
							timedOut = true;
							killProcessTree(child.pid!);
						}, options.timeout * 1000)
					: undefined;

			const onAbort = () => {
				if (child.pid) killProcessTree(child.pid);
			};

			if (options?.signal) {
				if (options.signal.aborted) {
					onAbort();
				} else {
					options.signal.addEventListener("abort", onAbort, { once: true });
				}
			}

			child.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			child.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			child.on("close", (code) => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				if (options?.signal) {
					options.signal.removeEventListener("abort", onAbort);
				}

				if (options?.signal?.aborted) {
					reject(new Error(`${stdout}\n${stderr}\nCommand aborted`.trim()));
					return;
				}

				if (timedOut) {
					reject(new Error(`${stdout}\n${stderr}\nCommand timed out after ${options?.timeout} seconds`.trim()));
					return;
				}

				resolve({ stdout, stderr, code: code ?? 0 });
			});
		});
	}

	getWorkspacePath(hostPath: string): string {
		return hostPath;
	}
}

class DockerExecutor implements Executor {
	constructor(
		private container: string,
		private cwd: string,
		private workspaceRoot: string,
	) {}

	async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
		const dockerCmd = `docker exec -w ${shellEscape(this.cwd)} ${this.container} sh -c ${shellEscape(command)}`;
		const hostExecutor = new HostExecutor(process.cwd());
		return hostExecutor.exec(dockerCmd, options);
	}

	getWorkspacePath(hostPath: string): string {
		return hostPath.startsWith(this.workspaceRoot) ? hostPath : this.workspaceRoot;
	}
}

function killProcessTree(pid: number): void {
	if (process.platform === "win32") {
		try {
			spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
				stdio: "ignore",
				detached: true,
			});
		} catch {
			// ignore
		}
	} else {
		try {
			process.kill(-pid, "SIGKILL");
		} catch {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// ignore
			}
		}
	}
}

function shellEscape(s: string): string {
	return `'${s.replace(/'/g, "'\\''")}'`;
}
