
import { handleApiRequest } from "./api.js";

/**
 * API Test Utilities
 * 
 * This file provides automated sanity checks for the authentication flow and protected endpoints.
 * It helps debug 403 Forbidden errors by testing both internal logic and external HTTP access.
 */

export async function runSanityChecks() {
  console.log("\x1b[36m%s\x1b[0m", "--- Starting API Sanity Checks ---");
  
  const baseUrl = "http://localhost:3000";
  let authToken = "";
  let csrfToken = "";
  let cookiesHeader = "";

  // 1. Check Health & Obtain CSRF Cookie
  try {
    console.log("[1/4] Checking /api/health and CSRF...");
    const healthRes = await fetch(`${baseUrl}/api/health`);
    console.log(`      Status: ${healthRes.status}`);
    
    // Extract XSRF-TOKEN from set-cookie header
    const setCookie = healthRes.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/XSRF-TOKEN=([^;]+)/);
      if (match) {
        csrfToken = match[1];
        cookiesHeader = `XSRF-TOKEN=${csrfToken}`;
        console.log(`      CSRF: Obtained token ${csrfToken.substring(0, 8)}...`);
      }
    } else {
      console.warn("      CSRF: No set-cookie header found in health check.");
    }
  } catch (err: any) {
    console.error(`      FAILED: Could not reach server at ${baseUrl}. Is it running?`);
    console.error(`      Error: ${err.message}`);
    return;
  }

  // 2. Test Login (Exempt from CSRF)
  try {
    console.log("[2/4] Testing /api/auth/login (admin/password123)...");
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookiesHeader
      },
      body: JSON.stringify({ username: "admin", password: "password123" })
    });
    
    const loginData = await loginRes.json();
    console.log(`      Status: ${loginRes.status}`);
    
    if (loginRes.ok) {
      authToken = loginData.token;
      console.log(`      SUCCESS: Auth token obtained.`);
    } else {
      console.error(`      FAILED: ${JSON.stringify(loginData)}`);
      return;
    }
  } catch (err: any) {
    console.error(`      EXCEPTION: ${err.message}`);
    return;
  }

  // 3. Test Protected GET (Requires Auth Token)
  try {
    console.log("[3/4] Testing protected GET /api/admin/auth-diagnostic...");
    const diagRes = await fetch(`${baseUrl}/api/admin/auth-diagnostic`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${authToken}`,
        "Cookie": cookiesHeader
      }
    });

    console.log(`      Status: ${diagRes.status}`);
    const diagData = await diagRes.json();

    if (diagRes.status === 403) {
      console.error("      ERROR: 403 Forbidden. This usually indicates a CSRF failure or CORS restriction.");
      console.log("      Check: Does the server expect CSRF on GET? (Usually no)");
    } else if (diagRes.ok) {
      console.log("      SUCCESS: Protected GET accessible.");
    } else {
      console.error(`      FAILED: ${diagRes.status} - ${JSON.stringify(diagData)}`);
    }
  } catch (err: any) {
    console.error(`      EXCEPTION: ${err.message}`);
  }

  // 4. Test Protected POST (Requires Auth Token + CSRF Header)
  try {
    console.log("[4/4] Testing protected POST /api/auth-ping...");
    const pingRes = await fetch(`${baseUrl}/api/auth-ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
        "X-XSRF-TOKEN": csrfToken,
        "Cookie": cookiesHeader
      },
      body: JSON.stringify({ test: "sanity-check" })
    });

    console.log(`      Status: ${pingRes.status}`);
    const pingData = await pingRes.json();

    if (pingRes.status === 403) {
      console.error("      CRITICAL: 403 Forbidden on POST. CSRF validation in server.ts failed.");
      console.log(`      Sent CSRF: ${csrfToken}`);
      console.log(`      Sent Cookie: ${cookiesHeader}`);
    } else if (pingRes.ok) {
      console.log("      SUCCESS: Protected POST accessible. CSRF validation passed.");
    } else {
      console.error(`      FAILED: ${pingRes.status} - ${JSON.stringify(pingData)}`);
    }
  } catch (err: any) {
    console.error(`      EXCEPTION: ${err.message}`);
  }

  console.log("\x1b[36m%s\x1b[0m", "--- Sanity Checks Completed ---");
}

// Simple test executor when run via tsx
const isMain = import.meta.url.startsWith('file:') && 
               (process.argv[1] && (import.meta.url.includes(process.argv[1]) || process.argv[1].includes('api_test_utils')));

if (isMain) {
  runSanityChecks().catch(err => {
    console.error("Fatal test error:", err);
    process.exit(1);
  });
}
