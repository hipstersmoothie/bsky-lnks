import "dotenv/config";

// Starts the firehose subscription
import "./stream.js";

// Starts the API server
import "./api.js";

// Starts the cron job
import "./cron.js";
