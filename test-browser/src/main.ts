import { Logger } from "logger-kit";
import { ConsoleTransport } from "logger-kit/transports/console";
import { HttpTransport } from "logger-kit/transports/httpTransport";

const logger = new Logger("debug", { app: "browser-test" });
logger.use(new ConsoleTransport());

// Test basic logging
logger.info("Hello from browser", { ok: true });
logger.debug("Debug message");
logger.warn("Warning message");
logger.error("Error message");

// Test context inheritance
const childLogger = logger.withContext({ requestId: "abc-123" });
childLogger.info("Child logger works", { extra: "data" });

// Test buffer mode
logger.enableBufferMode();
logger.info("This is buffered");
logger.info("This is also buffered");
logger.flush().then(() => {
  console.log("Buffer flushed!");
});

// Test test mode
logger.enableTestMode();
logger.warn("Captured in test mode");
console.log("Test logs:", logger.testLogs());

// Display results in the page
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>Logger Kit - Browser Test</h1>
    <p>Open the browser console to see log output.</p>
    <pre>${JSON.stringify(logger.testLogs(), null, 2)}</pre>
  </div>
`;

// Optional: Ensure HttpTransport compiles (don't actually call it without a real endpoint)
const _httpTransport = new HttpTransport("https://example.com/log");
console.log("HttpTransport instantiated:", !!_httpTransport);
