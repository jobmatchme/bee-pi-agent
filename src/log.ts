import chalk from "chalk";

export interface RunLogContext {
	runId: string;
	sessionId: string;
}

function timestamp(): string {
	const now = new Date();
	const hh = String(now.getHours()).padStart(2, "0");
	const mm = String(now.getMinutes()).padStart(2, "0");
	const ss = String(now.getSeconds()).padStart(2, "0");
	return `[${hh}:${mm}:${ss}]`;
}

function formatContext(ctx: RunLogContext): string {
	return `[run:${ctx.runId} session:${ctx.sessionId}]`;
}

export function logInfo(ctx: RunLogContext | "system", message: string): void {
	const prefix = ctx === "system" ? "[system]" : formatContext(ctx);
	console.error(chalk.blue(`${timestamp()} ${prefix} ${message}`));
}

export function logWarning(ctx: RunLogContext | "system", message: string, details?: string): void {
	const prefix = ctx === "system" ? "[system]" : formatContext(ctx);
	console.error(chalk.yellow(`${timestamp()} ${prefix} ${message}`));
	if (details) {
		console.error(chalk.dim(details));
	}
}

export function logError(ctx: RunLogContext | "system", message: string, details?: string): void {
	const prefix = ctx === "system" ? "[system]" : formatContext(ctx);
	console.error(chalk.red(`${timestamp()} ${prefix} ${message}`));
	if (details) {
		console.error(chalk.dim(details));
	}
}
