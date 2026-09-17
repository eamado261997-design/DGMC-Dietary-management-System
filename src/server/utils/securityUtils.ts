export interface SchemaFieldRule {
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  trim?: boolean;
  regex?: RegExp;
  min?: number;
  max?: number;
  allowedValues?: any[];
  elementTypes?: "string" | "number" | "object";
}

export const detectWafEvasion = (val: any, fieldKey: string = "", depth = 0): { ok: boolean; reason?: string } => {
    if (depth > 10) return { ok: false, reason: "Excessive payload nesting depth" };
    if (!val) return { ok: true };

    if (Array.isArray(val)) {
      for (const item of val) {
        const res = detectWafEvasion(item, fieldKey, depth + 1);
        if (!res.ok) return res;
      }
    } else if (typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        if (
          k.includes("$") || 
          k.includes(".") || 
          k.toLowerCase().includes("where") ||
          k.toLowerCase().includes("exec") ||
          k.toLowerCase().includes("eval")
        ) {
          return { ok: false, reason: `Suspicious object key signature detected: ${k}` };
        }
        const res = detectWafEvasion(v, k, depth + 1);
        if (!res.ok) return res;
      }
    } else if (typeof val === "string") {
      const lowerVal = val.toLowerCase();

      // Bypass checks for valid cryptographic tokens, base64 images, and expected long alphanumeric streams
      if (
        fieldKey.includes("token") || 
        fieldKey.includes("password") || 
        fieldKey.includes("hash") || 
        fieldKey.includes("signature") || 
        fieldKey.includes("base64") ||
        fieldKey.includes("qr_code") ||
        fieldKey.includes("logo") ||
        fieldKey.includes("image")
      ) {
         // Perform only highly critical checks for SQL/Command injection even on sensitive fields
         if (lowerVal.includes("union select") || lowerVal.includes("xp_cmdshell") || lowerVal.includes("drop table")) {
             return { ok: false, reason: "Critical SQL/Command injection signature in sensitive field" };
         }
         return { ok: true };
      }

      if (val.length > 50000 && !fieldKey.includes("base64")) {
         return { ok: false, reason: "Payload string exceeds maximum allowed safe length" };
      }

      // 1. Directory Traversal / LFI
      if (
        lowerVal.includes("../") || 
        lowerVal.includes("..\\") || 
        lowerVal.includes("/etc/passwd") || 
        lowerVal.includes("c:\\windows") ||
        lowerVal.includes("file://")
      ) {
        return { ok: false, reason: "Directory traversal (LFI/RFI) signature matched" };
      }

      // 2. NoSQL Injection (MongoDB/CouchDB specific operators in strings)
      if (
        lowerVal.includes("$where") || 
        lowerVal.includes("$ne") || 
        lowerVal.includes("$gt") || 
        lowerVal.includes("$regex") ||
        (lowerVal.includes("||") && lowerVal.includes("return")) 
      ) {
        return { ok: false, reason: "NoSQL Injection signature matched" };
      }

      // 3. LDAP Injection
      if (
        lowerVal.includes("*)") || 
        lowerVal.includes("(*") || 
        lowerVal.includes("(&") || 
        lowerVal.includes("(|") 
      ) {
        return { ok: false, reason: "LDAP Injection signature matched" };
      }

      // 4. XPath Injection
      if (
        lowerVal.includes("count(/") || 
        lowerVal.includes("concat(") || 
        lowerVal.includes("string-length(") || 
        lowerVal.includes("contains(") 
      ) {
        return { ok: false, reason: "XPath Injection signature matched" };
      }

      // 5. Server-Side Request Forgery (SSRF)
      if (
        lowerVal.match(/^https?:\/\/(169\.254\.169\.254|127\.0\.0\.1|localhost|0\.0\.0\.0)/) ||
        lowerVal.includes("aws-env") ||
        lowerVal.includes("metadata.google.internal") ||
        lowerVal.includes("169.254.169.254") ||
        lowerVal.includes("http://169.254") ||
        lowerVal.includes("http://127.0.0.1") ||
        lowerVal.includes("http://localhost") ||
        lowerVal.includes("file://") ||
        lowerVal.includes("gopher://") ||
        lowerVal.includes("dict://") ||
        lowerVal.includes("ftp://")
      ) {
        return { ok: false, reason: "SSRF (Server-Side Request Forgery) signature matched" };
      }

      // 6. Template Injection (SSTI)
      if (
        lowerVal.includes("{{") || 
        lowerVal.includes("}}") || 
        lowerVal.includes("${") || 
        lowerVal.includes("<%") || 
        lowerVal.includes("%>") ||
        lowerVal.includes("#{") ||
        lowerVal.includes("*{") ||
        lowerVal.includes("@{")
      ) {
        return { ok: false, reason: "Server-Side Template Injection (SSTI) signature matched" };
      }

      // 7. OS Command Injection
      if (
        lowerVal.includes("/bin/sh") || 
        lowerVal.includes("/bin/bash") || 
        lowerVal.includes("cmd.exe") || 
        lowerVal.includes("powershell") ||
        lowerVal.includes("wget ") ||
        lowerVal.includes("curl ") ||
        lowerVal.includes("nc -") ||
        lowerVal.includes("netcat ") ||
        lowerVal.includes("ping -c") ||
        lowerVal.includes("&& sleep") ||
        lowerVal.includes("; sleep") ||
        lowerVal.includes("| sleep") ||
        lowerVal.includes("`sleep") ||
        (lowerVal.includes("$(") && lowerVal.includes(")"))
      ) {
        return { ok: false, reason: "Remote command injection signature matched" };
      }

      // 8. Cross-site script tag / payload filters
      if (
        lowerVal.includes("<script") ||
        lowerVal.includes("javascript:") ||
        lowerVal.includes("vbscript:") ||
        lowerVal.includes("onload=") ||
        lowerVal.includes("onerror=") ||
        lowerVal.includes("onmouseover=") ||
        lowerVal.includes("onclick=") ||
        lowerVal.includes("onfocus=") ||
        lowerVal.includes("onblur=") ||
        lowerVal.includes("javascript\\x3a") ||
        lowerVal.includes("javascript&colon;") ||
        lowerVal.includes("expression(") ||
        lowerVal.includes("eval(")
      ) {
        return { ok: false, reason: "Cross-site scripting (XSS) exploit signature matched" };
      }

      // 9. SQL Injection: In-band (Classic/Error/Union-based SQLi)
      if (
        lowerVal.includes("union select") ||
        lowerVal.includes("union all select") ||
        (lowerVal.includes("select ") && lowerVal.includes("from ") && (lowerVal.includes("where") || lowerVal.includes("concat") || lowerVal.includes("information_schema") || lowerVal.includes("sys.schema"))) ||
        lowerVal.includes("insert into") ||
        lowerVal.includes("drop table") ||
        lowerVal.includes("alter table") ||
        lowerVal.includes("extractvalue(") ||
        lowerVal.includes("updatexml(") ||
        lowerVal.includes("floor(rand()") ||
        lowerVal.includes("concat_ws(") ||
        lowerVal.includes("group_concat(") ||
        lowerVal.includes("syscol") ||
        lowerVal.includes("db_name(") ||
        /\bextractvalue\b/g.test(lowerVal) ||
        /\bupdatexml\b/g.test(lowerVal)
      ) {
        return { ok: false, reason: "In-band SQL Injection detection signature matched" };
      }

      // 10. SQL Injection: Inferential (Blind/Boolean/Time-based SQLi)
      if (
        lowerVal.includes("waitfor delay") ||
        lowerVal.includes("pg_sleep(") ||
        lowerVal.includes("benchmark(") ||
        /sleep\(\s*\d+\s*\)/g.test(lowerVal) ||
        /\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+/g.test(lowerVal) ||
        /\band\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+/g.test(lowerVal) ||
        /\bcase\s+when\s+/g.test(lowerVal) ||
        (lowerVal.includes("if(") && (lowerVal.includes("sleep") || lowerVal.includes("benchmark") || lowerVal.includes("1="))) ||
        (lowerVal.includes("coalesce(") && lowerVal.includes("sleep"))
      ) {
        return { ok: false, reason: "Inferential / Blind SQL Injection detection signature matched" };
      }

      // 11. SQL Injection: Out-of-band (OOB SQLi / Data Exfiltration via unc network paths or external calls)
      if (
        lowerVal.includes("load_file(") ||
        lowerVal.includes("xp_dirtree") ||
        lowerVal.includes("xp_fileexist") ||
        lowerVal.includes("sys_eval") ||
        lowerVal.includes("sys_exec") ||
        /load_file\(\s*['"]\\\\/g.test(lowerVal) ||
        lowerVal.includes(".dnslog.cn") ||
        lowerVal.includes(".burpcollaborator") ||
        lowerVal.includes("http_request(") ||
        lowerVal.includes("utl_http.") ||
        lowerVal.includes("dbms_ldap_utl") ||
        lowerVal.includes("xp_cmdshell")
      ) {
        return { ok: false, reason: "Out-of-band (OOB) SQL Injection detection signature matched" };
      }

      // 12. Polyglot exploit payloads (multi-context XSS/SQL/Command combinations)
      if (
        /javascript\s*:\s*\/[*]/g.test(lowerVal) ||
        /\/[*]['"`][*]\//g.test(lowerVal) ||
        /\/[*]['"`][*]\/[*]/g.test(lowerVal) ||
        /\/[*]\s*\\['"`]\s*[*]\//g.test(lowerVal) || 
        /['"`]\s*\/[*]\s*['"`]\s*[*]\//g.test(lowerVal) ||
        (lowerVal.includes("/*") && lowerVal.includes("*/") && lowerVal.includes("<!--") && lowerVal.includes("-->")) ||
        (/<[^>]+(onload|onerror|onmouseover|onclick)[^>]*\/[*]/i.test(lowerVal)) ||
        (lowerVal.includes("<![cdata[") && (lowerVal.includes("<svg") || lowerVal.includes("<script")))
      ) {
        return { ok: false, reason: "Polyglot multi-context exploit signature matched" };
      }
    }
    
    return { ok: true };
};

export const sanitizeInputString = (val: string, key: string): string => {
  const isSensitive = /pass(word)?|secret|token|cred|logo|base64|qr_code|image/i.test(key);
  if (isSensitive) return val;
  return val
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Strip script tags
    .replace(/<\/?[^>]+(>|$)/g, ""); // Strip standard HTML tags
};

export const safeVal = (val: any, fieldKey: string = ""): any => {
  if (val === null || val === undefined) return val;
  if (typeof val === "function") return undefined;
  if (Array.isArray(val)) {
    return val.map(item => safeVal(item, fieldKey));
  }
  if (typeof val === "object") {
    const clean: any = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        continue;
      }
      clean[k] = safeVal(v, k);
    }
    return clean;
  }
  if (typeof val === "string") {
    return sanitizeInputString(val, fieldKey);
  }
  return val;
};

export const validateSchema = (
  data: any,
  schema: Record<string, SchemaFieldRule>,
  allowExtraKeys = true
): { ok: boolean; error?: string; sanitized?: any } => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Payload must be a JSON object" };
  }

  const sanitized: any = {};
  for (const [key, rules] of Object.entries(schema)) {
    let val = data[key];

    if (val === undefined || val === null) {
      if (rules.required) {
        return { ok: false, error: `Parameter '${key}' is required` };
      }
      continue;
    }

    const actualType = typeof val;

    if (rules.type === "string") {
      if (actualType === "number") {
        val = String(val);
      } else if (actualType !== "string") {
        return { ok: false, error: `Parameter '${key}' must be a string` };
      }
    } else if (rules.type === "number") {
      if (actualType === "string" && !isNaN(Number(val)) && val.trim() !== "") {
        val = Number(val);
      } else if (actualType !== "number") {
        return { ok: false, error: `Parameter '${key}' must be a number` };
      }
    } else if (rules.type === "boolean") {
      if (typeof val === "string") {
        if (val.toLowerCase() === "true") val = true;
        else if (val.toLowerCase() === "false") val = false;
      }
      if (typeof val !== "boolean") {
        return { ok: false, error: `Parameter '${key}' must be a boolean` };
      }
    } else if (rules.type === "array") {
      if (!Array.isArray(val)) {
        return { ok: false, error: `Parameter '${key}' must be an array` };
      }
    } else if (rules.type === "object") {
      if (actualType !== "object" || Array.isArray(val) || val === null) {
        return { ok: false, error: `Parameter '${key}' must be a JSON object` };
      }
    } else {
      if (actualType !== rules.type) {
        return { ok: false, error: `Parameter '${key}' must be of type '${rules.type}'` };
      }
    }

    if (typeof val === "string") {
      if (rules.trim) {
        val = val.trim();
      }
      if (rules.min !== undefined && val.length < rules.min) {
        return { ok: false, error: `Parameter '${key}' must be at least ${rules.min} characters` };
      }
      if (rules.max !== undefined && val.length > rules.max) {
        return { ok: false, error: `Parameter '${key}' exceeds maximum of ${rules.max} characters` };
      }
      if (rules.regex && !rules.regex.test(val)) {
        return { ok: false, error: `Parameter '${key}' format is invalid` };
      }
    }
    if (typeof val === "number") {
      if (rules.min !== undefined && val < rules.min) {
        return { ok: false, error: `Parameter '${key}' must be at least ${rules.min}` };
      }
      if (rules.max !== undefined && val > rules.max) {
        return { ok: false, error: `Parameter '${key}' exceeds maximum of ${rules.max}` };
      }
    }
    if (rules.allowedValues && !rules.allowedValues.includes(val)) {
      return { ok: false, error: `Parameter '${key}' contains an invalid value. Allowed options: ${JSON.stringify(rules.allowedValues)}` };
    }

    if (Array.isArray(val) && rules.elementTypes) {
      for (let idx = 0; idx < val.length; idx++) {
        const element = val[idx];
        if (rules.elementTypes === "object") {
          if (typeof element !== "object" || element === null || Array.isArray(element)) {
            return { ok: false, error: `Each element in array '${key}' must be an object` };
          }
        } else if (typeof element !== rules.elementTypes) {
          return { ok: false, error: `Each element in array '${key}' must be of type '${rules.elementTypes}'` };
        }
      }
    }
    sanitized[key] = val;
  }

  if (allowExtraKeys) {
    for (const [key, val] of Object.entries(data)) {
      if (sanitized[key] === undefined) {
        sanitized[key] = val;
      }
    }
  }

  return { ok: true, sanitized };
};

export const schemas: Record<string, Record<string, SchemaFieldRule>> = {
  "POST:/api/auth/login": {
    username: { type: "string", required: true, trim: true, min: 1, max: 100 },
    password: { type: "string", required: true, min: 1, max: 128 }
  },
  "POST:/api/auth/change-password": {
    currentPassword: { type: "string", required: true, min: 1, max: 128 },
    newPassword: { type: "string", required: true, min: 1, max: 128 }
  },
  "PUT:/api/settings": {
    settings: { type: "array", required: true, elementTypes: "object" }
  },
  "POST:/api/settings/logo": {
    logo_base64: { type: "string", required: true, min: 1 }
  },
  "POST:/api/departments": {
    name: { type: "string", required: true, trim: true, min: 1, max: 100 }
  },
  "POST:/api/admin/decrypt-field": {
    ciphertext: { type: "string", required: false, min: 1 },
    fields: { type: "object", required: false }
  },
  "PUT:/api/departments/:id": {
    name: { type: "string", required: true, trim: true, min: 1, max: 100 }
  },
  "POST:/api/admin/people": {
    username: { type: "string", required: true, trim: true, min: 3, max: 100 },
    password: { type: "string", required: true, min: 6, max: 128 },
    role: { type: "string", required: true, allowedValues: ["admin", "dietary_admin", "manager", "cashier", "employee"] },
    first_name: { type: "string", required: true, trim: true, min: 1, max: 100 },
    last_name: { type: "string", required: true, trim: true, min: 1, max: 100 },
    email: { type: "string", required: false, trim: true, max: 150 },
    phone: { type: "string", required: false, trim: true, max: 30 },
    is_active: { type: "boolean", required: false },
    employee_no: { type: "string", required: false, trim: true, max: 50 },
    position: { type: "string", required: false, trim: true, max: 100 },
    qr_code: { type: "string", required: false, trim: true, max: 100 },
    employee_status: { type: "string", required: false, allowedValues: ["active", "suspended", "on_leave"] },
    hire_date: { type: "string", required: false, trim: true, max: 20 }
  },
  "PUT:/api/admin/people/:id": {
    username: { type: "string", required: false, trim: true, min: 3, max: 100 },
    password: { type: "string", required: false, min: 6, max: 128 },
    role: { type: "string", required: false, allowedValues: ["admin", "dietary_admin", "manager", "cashier", "employee"] },
    first_name: { type: "string", required: false, trim: true, min: 1, max: 100 },
    last_name: { type: "string", required: false, trim: true, min: 1, max: 100 },
    email: { type: "string", required: false, trim: true, max: 150 },
    phone: { type: "string", required: false, trim: true, max: 30 },
    is_active: { type: "boolean", required: false },
    employee_no: { type: "string", required: false, trim: true, max: 50 },
    position: { type: "string", required: false, trim: true, max: 100 },
    qr_code: { type: "string", required: false, trim: true, max: 100 },
    employee_status: { type: "string", required: false, allowedValues: ["active", "suspended", "on_leave"] },
    hire_date: { type: "string", required: false, trim: true, max: 20 }
  },
  "POST:/api/manager/toggle-schedule": {
    person_id: { type: "number", required: true },
    work_date: { type: "string", required: true },
    shift_type: { type: "string", required: false, allowedValues: ["day", "night"] }
  },
  "POST:/api/manager/batch-schedules": {
    updates: { type: "array", required: true, elementTypes: "object" }
  },
  "POST:/api/cashier/scan": {
    qr_code: { type: "string", required: true, trim: true, min: 1, max: 200 }
  },
  "POST:/api/cashier/process": {
    person_id: { type: "number", required: true },
    is_free: { type: "boolean", required: false },
    meal_amount: { type: "number", required: false }
  }
};
