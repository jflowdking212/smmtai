const router = require('/home/smmt/apps/api/dist/routes/ai.js').default;
const { prisma } = require('/home/smmt/apps/api/dist/config/database.js');

// Mock database objects to prevent connection failures in programmatic tests
prisma.trend = { findFirst: async () => null };
prisma.user = { findUnique: async () => null };

// Get handlers
const captionHandler = router.stack.find(s => s.route && s.route.path === '/caption').route.stack.slice(-1)[0].handle;
const rewriteHandler = router.stack.find(s => s.route && s.route.path === '/rewrite').route.stack.slice(-1)[0].handle;

async function testLengthConstraints() {
  console.log("=== STARTING AI ROUTE LENGTH CONSTRAINT TESTS ===");

  const mockRes = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log(`Response Code: ${this.statusCode}`);
      console.log("Returned Data:", JSON.stringify(data, null, 2));
    }
  };

  // Test 1: Caption Short limit
  console.log("\n--- Testing /caption Short limit on Twitter ---");
  await captionHandler({
    body: {
      topic: "Tech industry shift towards decentralized intelligence",
      platform: "twitter",
      tone: "casual",
      length: "short"
    },
    workspaceId: "test-workspace-id"
  }, mockRes);

  // Test 2: Caption Long limit on Twitter (mock fallback should downgrade or handle appropriately)
  console.log("\n--- Testing /caption Long limit on Twitter ---");
  await captionHandler({
    body: {
      topic: "Tech industry shift towards decentralized intelligence",
      platform: "twitter",
      tone: "professional",
      length: "long"
    },
    workspaceId: "test-workspace-id"
  }, mockRes);

  // Test 3: Caption Long limit on Instagram
  console.log("\n--- Testing /caption Long limit on Instagram ---");
  await captionHandler({
    body: {
      topic: "Tech industry shift towards decentralized intelligence",
      platform: "instagram",
      tone: "professional",
      length: "long"
    },
    workspaceId: "test-workspace-id"
  }, mockRes);

  // Test 4: Rewrite Short limit on Twitter
  console.log("\n--- Testing /rewrite Short limit on Twitter ---");
  await rewriteHandler({
    body: {
      content: "This is a really long post about modern technology developments and how artificial intelligence is changing the game for content creation and posting across social media platforms like Twitter, Threads, and LinkedIn.",
      platform: "twitter",
      tone: "witty",
      length: "short"
    },
    workspaceId: "test-workspace-id"
  }, mockRes);

  console.log("\n=== AI ROUTE LENGTH CONSTRAINT TESTS COMPLETED ===");
  process.exit(0);
}

// Mock incrementUsage to avoid database side-effects in mock testing
const usage = require('/home/smmt/apps/api/dist/middleware/usage.js');
usage.incrementUsage = async () => {};

testLengthConstraints().catch(err => {
  console.error("Length constraint test failed:", err);
  process.exit(1);
});
