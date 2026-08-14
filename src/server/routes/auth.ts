import { jsonResponse, ApiResponse } from "../utils/apiUtils.js";
import { readDatabase, writeDatabase, hashPassword, verifyPassword, generateToken } from "../db.js";
import { isMysqlConnected, query, execute } from "../mysql.js";
import { generateXsrfToken } from "../auth.js";
import { LoginSchema } from "../schemas.js";
import { MIN_PASSWORD_LENGTH } from "../../constants/security.js";
import { validatePasswordComplexity } from "../../utils/password.js";
import { Person, LoginAttempt } from "../../types.js";

export async function handleAuthRoutes(
  method: string,
  path: string,
  body: any,
  headers: any,
  authUser: Person | null
): Promise<ApiResponse | null> {
  const nowStr = new Date().toISOString();

  // POST /api/auth/login
  if (path === "/api/auth/login" && method === "POST") {
    const result = LoginSchema.safeParse(body);
    if (!result.success) {
      return jsonResponse(400, { error: result.error.issues[0]?.message || "Invalid input" });
    }
    const { username, password } = result.data;

    let user: Person | null = null;
    let dbPassword = "";

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM people WHERE LOWER(username) = ? AND is_active = 1", [username.trim().toLowerCase()]);
      if (rows.length > 0) {
        user = rows[0];
        dbPassword = user.password;
      }
    } else {
      const db = readDatabase();
      const candidate = (db.people || []).find(p => p.username.toLowerCase() === username.trim().toLowerCase() && p.is_active);
      if (candidate) {
        user = candidate;
        dbPassword = candidate.password;
      }
    }

    if (!user || !verifyPassword(password, dbPassword)) {
      if (isMysqlConnected()) {
        await execute("INSERT INTO login_attempts (id, username, ip_address, success, timestamp) VALUES (NULL, ?, ?, 0, ?)", [
          username, headers["x-forwarded-for"] || "127.0.0.1", nowStr
        ]);
      } else {
        const db = readDatabase();
        if (!db.login_attempts) db.login_attempts = [];
        const nextId = db.login_attempts.length > 0 ? Math.max(...db.login_attempts.map((l: LoginAttempt) => l.id)) + 1 : 1;
        db.login_attempts.push({ id: nextId, username, ip_address: headers["x-forwarded-for"] || "127.0.0.1", success: false, timestamp: nowStr });
        writeDatabase(db);
      }
      return jsonResponse(401, { error: "Invalid username or password, or account is deactivated." });
    }

    if (isMysqlConnected()) {
      await execute("UPDATE people SET last_login = ? WHERE id = ?", [nowStr, user.id]);
      await execute("INSERT INTO login_attempts (id, username, ip_address, success, timestamp) VALUES (NULL, ?, ?, 1, ?)", [
        username, headers["x-forwarded-for"] || "127.0.0.1", nowStr
      ]);
    } else {
      const db = readDatabase();
      const p = (db.people || []).find((item: Person) => item.id === user?.id);
      if (p) p.last_login = nowStr;
      if (!db.login_attempts) db.login_attempts = [];
      const nextId = db.login_attempts.length > 0 ? Math.max(...db.login_attempts.map((l: LoginAttempt) => l.id)) + 1 : 1;
      db.login_attempts.push({ id: nextId, username, ip_address: headers["x-forwarded-for"] || "127.0.0.1", success: true, timestamp: nowStr });
      writeDatabase(db);
    }

    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    const xsrfToken = generateXsrfToken();
    const safeUser = { ...user };
    delete (safeUser as any).password;

    return jsonResponse(200, {
      success: true,
      token,
      user: safeUser
    }, {
      "XSRF-TOKEN": { value: xsrfToken, options: { httpOnly: false, secure: true, sameSite: "strict", path: "/" } }
    });
  }

  // POST /api/auth/refresh
  if (path === "/api/auth/refresh" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication session expired. Please sign in." });
    const newToken = generateToken({ id: authUser.id, username: authUser.username, role: authUser.role });
    const safeUser = { ...authUser };
    delete (safeUser as any).password;
    return jsonResponse(200, { success: true, token: newToken, user: safeUser });
  }

  // GET /api/auth/me
  if (path === "/api/auth/me" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication session expired. Please sign in." });
    const safeUser = { ...authUser };
    delete (safeUser as any).password;
    return jsonResponse(200, { success: true, user: safeUser });
  }

  // POST /api/auth/change-password
  if (path === "/api/auth/change-password" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication session expired. Please sign in." });
    const { currentPassword, newPassword } = body || {};
    if (!currentPassword || !newPassword) {
      return jsonResponse(400, { error: "Current password and new password are required" });
    }

    let storedHash = "";
    if (isMysqlConnected()) {
      const rows = await query("SELECT password FROM people WHERE id = ?", [authUser.id]);
      storedHash = rows[0]?.password || "";
    } else {
      const db = readDatabase();
      const p = db.people.find(item => item.id === authUser.id);
      storedHash = p ? p.password : "";
    }

    if (!verifyPassword(currentPassword, storedHash)) {
      return jsonResponse(400, { error: "Current password is incorrect" });
    }

    const passError = validatePasswordComplexity(newPassword, MIN_PASSWORD_LENGTH);
    if (passError) {
      return jsonResponse(400, { error: passError });
    }

    const newHash = hashPassword(newPassword);
    if (isMysqlConnected()) {
      await execute("UPDATE people SET password = ?, updated_at = ? WHERE id = ?", [newHash, nowStr, authUser.id]);
    } else {
      const db = readDatabase();
      const p = db.people.find(item => item.id === authUser.id);
      if (p) {
        p.password = newHash;
        p.updated_at = nowStr;
        writeDatabase(db);
      }
    }

    return jsonResponse(200, { success: true, message: "Password changed successfully" });
  }

  return null;
}
