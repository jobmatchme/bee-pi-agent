import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { Executor } from "../sandbox.js";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, type TruncationResult, truncateTail } from "./truncate.js";

function getTempFilePath(): string {
	const id = randomBytes(8).toString("hex");
	return join(tmpdir(), `pi-agent-worker-bash-${id}.log`);
}

const bashSchema = Type.Object({
	label: Type.String({ description: "Brief description of what this command does (shown to user)" }),
	command: Type.String({ description: "Bash command to execute" }),
	timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (optional)" })),
});

interface BashToolDetails {
	timeout?: number;
	truncation?: TruncationResult;
	fullOutputPath?: string;
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

function resolveBashTimeout(requestedTimeout: number | undefined): number | undefined {
	const configuredTimeout = readPositiveNumberEnv(
		"BEE_PI_AGENT_BASH_TIMEOUT_SECONDS",
		"PI_AGENT_WORKER_BASH_TIMEOUT_SECONDS",
	);
	if (configuredTimeout === undefined) return requestedTimeout;
	if (requestedTimeout === undefined || requestedTimeout <= 0) return configuredTimeout;
	return Math.min(requestedTimeout, configuredTimeout);
}

export function createBashTool(executor: Executor): AgentTool<typeof bashSchema> {
	return {
		name: "bash",
		label: "bash",
		description: `Execute a bash command in the current working directory. Output is truncated to the last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB. BEE_PI_AGENT_BASH_TIMEOUT_SECONDS can set a default/hard maximum command timeout.`,
		parameters: bashSchema,
		execute: async (
			_toolCallId: string,
			{ command, timeout }: { label: string; command: string; timeout?: number },
			signal?: AbortSignal,
		) => {
			let tempFilePath: string | undefined;
			const resolvedTimeout = resolveBashTimeout(timeout);

			const result = await executor.exec(command, { timeout: resolvedTimeout, signal });
			let output = "";
			if (result.stdout) output += result.stdout;
			if (result.stderr) {
				if (output) output += "\n";
				output += result.stderr;
			}

			const totalBytes = Buffer.byteLength(output, "utf-8");
			if (totalBytes > DEFAULT_MAX_BYTES) {
				tempFilePath = getTempFilePath();
				const tempFileStream = createWriteStream(tempFilePath);
				tempFileStream.write(output);
				tempFileStream.end();
			}

			const truncation = truncateTail(output);
			let outputText = truncation.content || "(no output)";
			let details: BashToolDetails | undefined = resolvedTimeout ? { timeout: resolvedTimeout } : undefined;

			if (truncation.truncated) {
				details = { ...details, truncation, fullOutputPath: tempFilePath };
				const startLine = truncation.totalLines - truncation.outputLines + 1;
				const endLine = truncation.totalLines;

				if (truncation.lastLinePartial) {
					const lastLineSize = formatSize(Buffer.byteLength(output.split("\n").pop() || "", "utf-8"));
					outputText += `\n\n[Showing last ${formatSize(truncation.outputBytes)} of line ${endLine} (line is ${lastLineSize}). Full output: ${tempFilePath}]`;
				} else if (truncation.truncatedBy === "lines") {
					outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}. Full output: ${tempFilePath}]`;
				} else {
					outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Full output: ${tempFilePath}]`;
				}
			}

			if (result.code !== 0) {
				throw new Error(`${outputText}\n\nCommand exited with code ${result.code}`.trim());
			}

			return { content: [{ type: "text", text: outputText }], details };
		},
	};
}
