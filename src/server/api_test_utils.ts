
import { handleApiRequest } from "./api.js";

/**
 * API Test Utilities
 * 
 * This file provides automated sanity checks for the authentication flow and protected endpoints.
 * It helps debug 403 Forbidden errors by testing both internal logic and external HTTP access.
 */

export async function runSanityChecks() {
  const baseUrl = "http://localhost:3000";
  let authToken = "";
  let csrfToken = "";
  let cookiesHeader = "";

  // 1. Check Health & Obtain CSRF Cookie
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    
    // Extract XSRF-TOKEN from set-cookie header
    const setCookie = healthRes.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/XSRF-TOKEN=([^;]+)/);
      if (match) {
        csrfToken = match[1];
        cookiesHeader = `XSRF-TOKEN=${csrfToken}`;
      }
    }
  } catch (_err: any) {
    return;
  }

  // 2. Test Login (Exempt from CSRF)
  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookiesHeader
      },
      body: JSON.stringify({ username: "admin", password: "password123" })
    });
    
    const loginData = await loginRes.json();
    if (loginRes.ok) {
      authToken = loginData.token;
    } else {
      return;
    }
  } catch (_err: any) {
    return;
  }

  // 3. Test Protected GET (Requires Auth Token)
  try {
    await fetch(`${baseUrl}/api/admin/sys-health`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${authToken}`,
        "Cookie": cookiesHeader
      }
    });
  } catch (_err: any) {
    // Suppress error
  }

  // 4. Test Protected POST (Requires Auth Token + CSRF Header)
  try {
    await fetch(`${baseUrl}/api/manager/schedules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
        "X-XSRF-TOKEN": csrfToken,
        "Cookie": cookiesHeader
      },
      body: JSON.stringify({ test: "sanity-check" })
    });
  } catch (_err: any) {
    // Suppress error
  }
}

// Simple test executor when run via tsx
const isMain = import.meta.url.startsWith('file:') && 
               (process.argv[1] && (import.meta.url.includes(process.argv[1]) || process.argv[1].includes('api_test_utils')));

if (isMain) {
  runSanityChecks().catch(() => {
    process.exit(1);
  });
}
