import { postScheduler } from "@/lib/scheduler/scheduler";

console.log("🚀 Starting Social Media Scheduler...");
postScheduler.start();

// Keep the process running
process.on("SIGINT", () => {
	console.log("🛑 Stopping scheduler...");
	process.exit(0);
});
