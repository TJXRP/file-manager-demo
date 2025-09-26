// Simple API test endpoint
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing
app.use(express.json());

// Test endpoint
app.get("/api/test", (req, res) => {
  console.log("✅ API test endpoint hit!");
  res.json({
    success: true,
    message: "API is working!",
    timestamp: new Date().toISOString(),
  });
});

// Serve static files
app.use(express.static("public"));

// Root route
app.get("/", (req, res) => {
  res.send(`
    <html>
    <body>
      <h1>API Test</h1>
      <button onclick="testAPI()">Test API</button>
      <div id="result"></div>
      <script>
        async function testAPI() {
          try {
            const response = await fetch('/api/test');
            const data = await response.json();
            document.getElementById('result').innerHTML = 
              '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
          } catch (error) {
            document.getElementById('result').innerHTML = 
              '<p style="color:red">Error: ' + error.message + '</p>';
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🧪 API Test Server running on port ${PORT}`);
  console.log(`🔗 Visit: http://localhost:${PORT}`);
  console.log(`🔗 API Test: http://localhost:${PORT}/api/test`);
});
