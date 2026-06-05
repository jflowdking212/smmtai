const router = require('/home/smmt/apps/api/dist/routes/trends.js').trendsRouter || require('/home/smmt/apps/api/dist/routes/trends.js').default;
const { prisma } = require('/home/smmt/apps/api/dist/config/database.js');

// Mock database objects to prevent database side-effects in programmatic tests
prisma.trend = { findFirst: async () => ({ topic: "Decentralized AI", country: "United Kingdom" }) };
prisma.user = { findUnique: async () => null };

// Get handler for POST /generate-post
const generatePostHandler = router.stack.find(s => s.route && s.route.path === '/generate-post').route.stack.slice(-1)[0].handle;

async function testGeneratePost() {
  console.log("=== STARTING GENERATE POST ALIGNMENT & STYLE GUIDE TESTS ===");

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

  // Test 1: Generate post for Entrepreneurs platform, extra long
  console.log("\n--- Testing /generate-post for Entreprenrs (Extra Long) ---");
  await generatePostHandler({
    body: {
      topic: "Building startup MVPs quickly",
      platform: "entreprenrs",
      category: "Business",
      length: "extra_long"
    },
    userId: "test-user-id"
  }, mockRes);

  // Test 2: Generate post for Christians platform, short
  console.log("\n--- Testing /generate-post for Chrxstians (Short) ---");
  await generatePostHandler({
    body: {
      topic: "Walking in faith daily",
      platform: "chrxstians",
      category: "Lifestyle",
      length: "short"
    },
    userId: "test-user-id"
  }, mockRes);

  // Test 3: Generate post for Iohah platform, medium
  console.log("\n--- Testing /generate-post for Iohah (Medium) ---");
  await generatePostHandler({
    body: {
      topic: "Holistic herbal remedies for stress",
      platform: "iohah",
      category: "Health",
      length: "medium"
    },
    userId: "test-user-id"
  }, mockRes);

  console.log("\n=== GENERATE POST ALIGNMENT & STYLE GUIDE TESTS COMPLETED ===");
  process.exit(0);
}

// Mock detectUserCountry helper
const trendsFile = require('/home/smmt/apps/api/dist/routes/trends.js');
// Mocking if it exists as standard function
if (trendsFile.detectUserCountry) {
  trendsFile.detectUserCountry = async () => "United Kingdom";
}

testGeneratePost().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
