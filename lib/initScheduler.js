import { postScheduler } from "./scheduler/scheduler";

export function initScheduler() {
	// Start scheduler when app starts
	postScheduler.start();

	// Also expose for manual control
	global.postScheduler = postScheduler;

	console.log("🚀 Social media scheduler initialized");
}
