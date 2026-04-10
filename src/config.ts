import type { WorkerRuntimeConfig, WorkerSandboxConfig } from "./types.js";

function readEnv(...names: string[]): string | undefined {
	for (const name of names) {
		const value = process.env[name];
		if (value) return value;
	}
	return undefined;
}

function loadSandboxConfigFromEnv(): WorkerSandboxConfig | undefined {
	const raw = readEnv("BEE_PI_AGENT_SANDBOX", "PI_AGENT_WORKER_SANDBOX");
	if (!raw || raw === "host") return { type: "host" };
	if (raw.startsWith("docker:")) {
		return {
			type: "docker",
			container: raw.slice("docker:".length),
			workspaceRoot:
				readEnv("BEE_PI_AGENT_DOCKER_WORKSPACE_ROOT", "PI_AGENT_WORKER_DOCKER_WORKSPACE_ROOT") || "/workspace",
		};
	}

	throw new Error("Invalid BEE_PI_AGENT_SANDBOX. Use 'host' or 'docker:<container>'.");
}

export function loadWorkerRuntimeConfigFromEnv(): WorkerRuntimeConfig {
	const rootDir = readEnv("BEE_PI_AGENT_WORKSPACE_ROOT", "PI_AGENT_WORKER_WORKSPACE_ROOT");
	if (!rootDir) {
		throw new Error("Missing BEE_PI_AGENT_WORKSPACE_ROOT");
	}

	return {
		workspace: {
			rootDir,
			cwd: readEnv("BEE_PI_AGENT_WORKSPACE_CWD", "PI_AGENT_WORKER_WORKSPACE_CWD"),
			stateDir: readEnv("BEE_PI_AGENT_STATE_DIR", "PI_AGENT_WORKER_STATE_DIR"),
			memoryFile: readEnv("BEE_PI_AGENT_MEMORY_FILE", "PI_AGENT_WORKER_MEMORY_FILE"),
			skillsDir: readEnv("BEE_PI_AGENT_SKILLS_DIR", "PI_AGENT_WORKER_SKILLS_DIR"),
		},
		blobStore: {
			rootDir:
				readEnv("BEE_PI_AGENT_BLOB_STORE_ROOT", "PI_AGENT_WORKER_BLOB_STORE_ROOT", "HUDAI_BLOB_STORE_ROOT") ||
				`${rootDir}/.bee-blob-store`,
		},
		model:
			readEnv("BEE_PI_AGENT_MODEL_PROVIDER", "PI_AGENT_WORKER_MODEL_PROVIDER") ||
			readEnv("BEE_PI_AGENT_MODEL_ID", "PI_AGENT_WORKER_MODEL_ID")
				? {
						provider: readEnv("BEE_PI_AGENT_MODEL_PROVIDER", "PI_AGENT_WORKER_MODEL_PROVIDER"),
						modelId: readEnv("BEE_PI_AGENT_MODEL_ID", "PI_AGENT_WORKER_MODEL_ID"),
					}
				: undefined,
		sandbox: loadSandboxConfigFromEnv(),
		systemPromptAppend: readEnv("BEE_PI_AGENT_SYSTEM_PROMPT_APPEND", "PI_AGENT_WORKER_SYSTEM_PROMPT_APPEND"),
	};
}
