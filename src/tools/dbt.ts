import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { Executor } from "../sandbox.js";
import { DEFAULT_MAX_BYTES, formatSize, type TruncationResult, truncateHead, truncateTail } from "./truncate.js";

const DBT_ACTIONS = ["list", "show", "build", "compile", "run", "test", "parse"] as const;
type DbtAction = (typeof DBT_ACTIONS)[number];

const dbtSchema = Type.Object({
	label: Type.String({ description: "Brief description of what you're doing with dbt (shown to user)" }),
	action: Type.String({
		description: "dbt action: list, show, build, compile, run, test, or parse",
	}),
	select: Type.Optional(
		Type.String({
			description: "dbt selector expression, e.g. my_model, +my_model, path:analyses/playground/*",
		}),
	),
	inlineSql: Type.Optional(
		Type.String({
			description:
				"Inline SQL for dbt show, e.g. select * from {{ ref('my_model') }}. Do not include a trailing semicolon or SQL LIMIT; use limit instead.",
		}),
	),
	target: Type.Optional(Type.String({ description: "Optional dbt target override, e.g. dev, stage, prod" })),
	vars: Type.Optional(Type.String({ description: "Optional dbt vars string, usually YAML or JSON" })),
	limit: Type.Optional(Type.Number({ description: "Optional row limit for dbt show" })),
	output: Type.Optional(Type.String({ description: "Optional output mode, e.g. json for dbt list/show" })),
	resourceTypes: Type.Optional(Type.Array(Type.String({ description: "dbt resource type" }))),
	fullRefresh: Type.Optional(Type.Boolean({ description: "Whether to pass --full-refresh for build/run" })),
	defer: Type.Optional(Type.Boolean({ description: "Whether to pass --defer" })),
	state: Type.Optional(Type.String({ description: "Optional dbt state path used with --defer/--state" })),
	favorState: Type.Optional(Type.Boolean({ description: "Whether to pass --favor-state" })),
	timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (optional)" })),
});

interface DbtToolDetails {
	action: DbtAction;
	dbtExecutable: string;
	projectDir?: string;
	profilesDir?: string;
	target?: string;
	timeout?: number;
	pgOptions?: string;
	truncation?: TruncationResult;
	fullOutputPath?: string;
	command: string;
}

function readEnv(...names: string[]): string | undefined {
	for (const name of names) {
		const value = process.env[name];
		if (value) return value;
	}
	return undefined;
}

function readPositiveNumberEnv(...names: string[]): number | undefined {
	const value = readEnv(...names);
	if (!value) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveIfPresent(baseDir: string, value: string | undefined): string | undefined {
	if (!value) return undefined;
	return resolve(baseDir, value);
}

function findNearestDbtProject(startDir: string): string | undefined {
	let current = resolve(startDir);
	while (true) {
		if (existsSync(join(current, "dbt_project.yml"))) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			return undefined;
		}
		current = parent;
	}
}

function resolveDbtProjectDir(workspaceRoot: string, workingDir: string): string | undefined {
	const configured = resolveIfPresent(
		process.cwd(),
		readEnv("BEE_PI_AGENT_DBT_PROJECT_DIR", "PI_AGENT_WORKER_DBT_PROJECT_DIR"),
	);
	if (configured) return configured;

	return findNearestDbtProject(workingDir) || findNearestDbtProject(workspaceRoot);
}

function resolveDbtProfilesDir(projectDir: string | undefined): string | undefined {
	const configured = resolveIfPresent(
		process.cwd(),
		readEnv("BEE_PI_AGENT_DBT_PROFILES_DIR", "PI_AGENT_WORKER_DBT_PROFILES_DIR", "DBT_PROFILES_DIR"),
	);
	if (configured) return configured;
	if (projectDir && existsSync(join(projectDir, "profiles.yml"))) {
		return projectDir;
	}
	return undefined;
}

function resolveDbtExecutable(projectDir: string | undefined, workspaceRoot: string, workingDir: string): string {
	const configured = readEnv("BEE_PI_AGENT_DBT_COMMAND", "PI_AGENT_WORKER_DBT_COMMAND");
	if (configured) {
		return configured.includes("/") || configured.startsWith(".") ? resolve(process.cwd(), configured) : configured;
	}

	const candidates = [
		projectDir ? join(projectDir, ".venv", "bin", "dbt") : undefined,
		join(workingDir, ".venv", "bin", "dbt"),
		join(workspaceRoot, ".venv", "bin", "dbt"),
	].filter((value): value is string => Boolean(value));

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return "dbt";
}

function getTempFilePath(): string {
	const id = randomBytes(8).toString("hex");
	return join(tmpdir(), `bee-pi-agent-dbt-${id}.log`);
}

function shellEscape(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

function normalizeInlineSql(value: string): string {
	return value.trim().replace(/;+\s*$/, "");
}

function assertDbtAction(value: string): DbtAction {
	if ((DBT_ACTIONS as readonly string[]).includes(value)) {
		return value as DbtAction;
	}
	throw new Error(`Unsupported dbt action '${value}'. Use one of: ${DBT_ACTIONS.join(", ")}`);
}

function resolveDbtTimeout(requestedTimeout: number | undefined): number | undefined {
	const configuredTimeout = readPositiveNumberEnv(
		"BEE_PI_AGENT_DBT_TIMEOUT_SECONDS",
		"PI_AGENT_WORKER_DBT_TIMEOUT_SECONDS",
	);
	if (configuredTimeout === undefined) return requestedTimeout;
	if (requestedTimeout === undefined || requestedTimeout <= 0) return configuredTimeout;
	return Math.min(requestedTimeout, configuredTimeout);
}

function resolveDbtPgOptions(): string | undefined {
	return readEnv("BEE_PI_AGENT_DBT_PGOPTIONS", "PI_AGENT_WORKER_DBT_PGOPTIONS", "PGOPTIONS");
}

function applyDbtPgOptions(command: string, pgOptions: string | undefined): string {
	if (!pgOptions) return command;
	return `PGOPTIONS=${shellEscape(pgOptions)} ${command}`;
}

function buildDbtCommand(args: {
	dbtExecutable: string;
	projectDir?: string;
	profilesDir?: string;
	action: DbtAction;
	select?: string;
	inlineSql?: string;
	target?: string;
	vars?: string;
	limit?: number;
	output?: string;
	resourceTypes?: string[];
	fullRefresh?: boolean;
	defer?: boolean;
	state?: string;
	favorState?: boolean;
}): string {
	const command: string[] = [shellEscape(args.dbtExecutable)];

	if (args.projectDir) {
		command.push("--project-dir", shellEscape(args.projectDir));
	}
	if (args.profilesDir) {
		command.push("--profiles-dir", shellEscape(args.profilesDir));
	}

	command.push(args.action);

	if (args.target) {
		command.push("--target", shellEscape(args.target));
	}
	if (args.vars) {
		command.push("--vars", shellEscape(args.vars));
	}
	if (args.output) {
		command.push("--output", shellEscape(args.output));
	}
	if (args.fullRefresh) {
		command.push("--full-refresh");
	}
	if (args.defer) {
		command.push("--defer");
	}
	if (args.state) {
		command.push("--state", shellEscape(args.state));
	}
	if (args.favorState) {
		command.push("--favor-state");
	}

	if (args.action === "show") {
		if (args.inlineSql) {
			command.push("--inline", shellEscape(normalizeInlineSql(args.inlineSql)));
		} else if (args.select) {
			command.push("--select", shellEscape(args.select));
		} else {
			throw new Error("dbt show requires either select or inlineSql");
		}

		if (args.limit !== undefined) {
			command.push("--limit", String(args.limit));
		}
		return command.join(" ");
	}

	if (args.action === "parse") {
		return command.join(" ");
	}

	if (!args.select) {
		throw new Error(`dbt ${args.action} requires select`);
	}

	command.push("--select", shellEscape(args.select));

	if (args.resourceTypes && args.resourceTypes.length > 0) {
		for (const resourceType of args.resourceTypes) {
			command.push("--resource-type", shellEscape(resourceType));
		}
	}

	if (args.action === "build" || args.action === "compile" || args.action === "run" || args.action === "test") {
		command.push("--quiet");
		command.push("--warn-error-options", shellEscape('{"error": ["NoNodesForSelectionCriteria"]}'));
	}

	return command.join(" ");
}

function extractOutputText(action: DbtAction, output: string): { text: string; truncation: TruncationResult } {
	const truncation = action === "show" || action === "list" ? truncateHead(output) : truncateTail(output);
	return {
		text: truncation.content || "(no output)",
		truncation,
	};
}

export function createDbtTool(
	executor: Executor,
	workspaceRoot: string,
	workingDir: string,
): AgentTool<typeof dbtSchema> {
	return {
		name: "dbt",
		label: "dbt",
		description:
			"Run dbt commands for model discovery, compilation, execution, and inline SQL preview. Supports list/show/build/compile/run/test/parse. Configure BEE_PI_AGENT_DBT_PROJECT_DIR and optionally BEE_PI_AGENT_DBT_COMMAND / BEE_PI_AGENT_DBT_PROFILES_DIR. BEE_PI_AGENT_DBT_TIMEOUT_SECONDS can set a default/hard maximum command timeout; BEE_PI_AGENT_DBT_PGOPTIONS can set PostgreSQL runtime guards such as statement_timeout.",
		parameters: dbtSchema,
		execute: async (
			_toolCallId: string,
			{
				action,
				select,
				inlineSql,
				target,
				vars,
				limit,
				output,
				resourceTypes,
				fullRefresh,
				defer,
				state,
				favorState,
				timeout,
			}: {
				label: string;
				action: string;
				select?: string;
				inlineSql?: string;
				target?: string;
				vars?: string;
				limit?: number;
				output?: string;
				resourceTypes?: string[];
				fullRefresh?: boolean;
				defer?: boolean;
				state?: string;
				favorState?: boolean;
				timeout?: number;
			},
			signal?: AbortSignal,
		) => {
			const resolvedAction = assertDbtAction(action);
			const projectDir = resolveDbtProjectDir(workspaceRoot, workingDir);
			const profilesDir = resolveDbtProfilesDir(projectDir);
			const dbtExecutable = resolveDbtExecutable(projectDir, workspaceRoot, workingDir);
			const resolvedTarget = target || readEnv("BEE_PI_AGENT_DBT_TARGET", "PI_AGENT_WORKER_DBT_TARGET");
			const resolvedTimeout = resolveDbtTimeout(timeout);
			const resolvedPgOptions = resolveDbtPgOptions();
			const command = applyDbtPgOptions(
				buildDbtCommand({
					dbtExecutable,
					projectDir,
					profilesDir,
					action: resolvedAction,
					select,
					inlineSql,
					target: resolvedTarget,
					vars,
					limit,
					output,
					resourceTypes,
					fullRefresh,
					defer,
					state,
					favorState,
				}),
				resolvedPgOptions,
			);

			const result = await executor.exec(command, { timeout: resolvedTimeout, signal });
			let combinedOutput = "";
			if (result.stdout) combinedOutput += result.stdout;
			if (result.stderr) {
				if (combinedOutput) combinedOutput += "\n";
				combinedOutput += result.stderr;
			}

			let fullOutputPath: string | undefined;
			if (Buffer.byteLength(combinedOutput, "utf-8") > DEFAULT_MAX_BYTES) {
				fullOutputPath = getTempFilePath();
				const stream = createWriteStream(fullOutputPath);
				stream.write(combinedOutput);
				stream.end();
			}

			const truncated = extractOutputText(resolvedAction, combinedOutput || "");
			if (truncated.truncation.truncated && !fullOutputPath) {
				fullOutputPath = getTempFilePath();
				const stream = createWriteStream(fullOutputPath);
				stream.write(combinedOutput);
				stream.end();
			}
			let text = truncated.text;
			if (truncated.truncation.truncated && fullOutputPath) {
				if (resolvedAction === "show" || resolvedAction === "list") {
					const endLine = truncated.truncation.outputLines;
					text += `\n\n[Showing first ${endLine} lines of ${truncated.truncation.totalLines} (${formatSize(truncated.truncation.outputBytes)} shown). Full output: ${fullOutputPath}]`;
				} else if (truncated.truncation.lastLinePartial) {
					text += `\n\n[Showing last ${formatSize(truncated.truncation.outputBytes)} of command output. Full output: ${fullOutputPath}]`;
				} else {
					const startLine = truncated.truncation.totalLines - truncated.truncation.outputLines + 1;
					const endLine = truncated.truncation.totalLines;
					text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncated.truncation.totalLines}. Full output: ${fullOutputPath}]`;
				}
			}

			if (result.code !== 0) {
				throw new Error(
					[
						text,
						`dbt command failed with exit code ${result.code}`,
						`command: ${command}`,
						projectDir ? `projectDir: ${projectDir}` : "projectDir: (not resolved)",
						dbtExecutable === "dbt"
							? "hint: configure BEE_PI_AGENT_DBT_COMMAND if dbt is not on PATH"
							: undefined,
					]
						.filter(Boolean)
						.join("\n\n"),
				);
			}

			const details: DbtToolDetails = {
				action: resolvedAction,
				dbtExecutable,
				projectDir,
				profilesDir,
				target: resolvedTarget,
				timeout: resolvedTimeout,
				pgOptions: resolvedPgOptions,
				truncation: truncated.truncation.truncated ? truncated.truncation : undefined,
				fullOutputPath,
				command,
			};

			return {
				content: [{ type: "text", text }],
				details,
			};
		},
	};
}
