import { isMysqlConnected, query } from "../mysql.js";
import { isSqliteConnected, getSqliteDb } from "../sqlite.js";
import { readDatabase } from "../db.js";

export interface PublicStatsData {
  success: boolean;
  totalStaff: number;
  mealsProcessed: number;
  companyName: string;
  companyTagline: string;
  companyLogoUrl: string;
  currencySymbol: string;
  mealPrice: number;
  itSupportPhone: string;
}

let cachedStats: { data: PublicStatsData; timestamp: number } | null = null;
const CACHE_TTL_MS = 15000; // 15-second TTL in-memory cache for high performance & low latency

export async function getPublicStats(): Promise<PublicStatsData> {
  const now = Date.now();
  if (cachedStats && now - cachedStats.timestamp < CACHE_TTL_MS) {
    return cachedStats.data;
  }

  let totalStaff = 0;
  let mealsProcessed = 0;
  let companyName = "Divine Grace Medical Center";
  let companyTagline = "Compassionate Care, Exceptional Service";
  let companyLogoUrl = "";
  let currencySymbol = "₱";
  let mealPrice = 150.0;
  let itSupportPhone = "Medical arts Bldg. 5th floor/ICT dept. / 2568";

  try {
    if (isMysqlConnected()) {
      // 1. Total active personnel
      const staffRows = await query("SELECT COUNT(*) as cnt FROM people WHERE is_active = 1");
      if (staffRows && staffRows.length > 0) {
        totalStaff = Number(staffRows[0].cnt) || 0;
      }

      // 2. Total meals processed
      const mealRows = await query("SELECT COUNT(*) as cnt FROM transactions WHERE status = 'completed'");
      if (mealRows && mealRows.length > 0) {
        mealsProcessed = Number(mealRows[0].cnt) || 0;
      }

      // 3. Hospital branding and system configuration
      const settingsRows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('company_name', 'company_tagline', 'company_logo_url', 'currency_symbol', 'meal_price', 'it_support_phone')"
      );
      if (settingsRows && settingsRows.length > 0) {
        for (const row of settingsRows) {
          if (row.setting_key === "company_name" && row.setting_value) companyName = row.setting_value;
          if (row.setting_key === "company_tagline" && row.setting_value) companyTagline = row.setting_value;
          if (row.setting_key === "company_logo_url" && row.setting_value) companyLogoUrl = row.setting_value;
          if (row.setting_key === "currency_symbol" && row.setting_value) currencySymbol = row.setting_value;
          if (row.setting_key === "meal_price" && row.setting_value) mealPrice = parseFloat(row.setting_value) || 150.0;
          if (row.setting_key === "it_support_phone" && row.setting_value) itSupportPhone = row.setting_value;
        }
      }
    } else if (isSqliteConnected()) {
      const sdb = getSqliteDb();
      if (sdb) {
        const staffRow = sdb.prepare("SELECT COUNT(*) as cnt FROM people WHERE is_active = 1").get() as any;
        if (staffRow) totalStaff = staffRow.cnt || 0;

        const mealRow = sdb.prepare("SELECT COUNT(*) as cnt FROM transactions WHERE status = 'completed'").get() as any;
        if (mealRow) mealsProcessed = mealRow.cnt || 0;

        const settingsRows = sdb.prepare(
          "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('company_name', 'company_tagline', 'company_logo_url', 'currency_symbol', 'meal_price', 'it_support_phone')"
        ).all() as any[];
        for (const row of settingsRows) {
          if (row.setting_key === "company_name" && row.setting_value) companyName = row.setting_value;
          if (row.setting_key === "company_tagline" && row.setting_value) companyTagline = row.setting_value;
          if (row.setting_key === "company_logo_url" && row.setting_value) companyLogoUrl = row.setting_value;
          if (row.setting_key === "currency_symbol" && row.setting_value) currencySymbol = row.setting_value;
          if (row.setting_key === "meal_price" && row.setting_value) mealPrice = parseFloat(row.setting_value) || 150.0;
          if (row.setting_key === "it_support_phone" && row.setting_value) itSupportPhone = row.setting_value;
        }
      }
    } else {
      const db = readDatabase();
      totalStaff = (db.people || []).filter((p: any) => p.is_active).length;
      mealsProcessed = (db.transactions || []).filter((t: any) => t.status === "completed").length;
      for (const s of (db.system_settings || [])) {
        if (s.setting_key === "company_name" && s.setting_value) companyName = s.setting_value;
        if (s.setting_key === "company_tagline" && s.setting_value) companyTagline = s.setting_value;
        if (s.setting_key === "company_logo_url" && s.setting_value) companyLogoUrl = s.setting_value;
        if (s.setting_key === "currency_symbol" && s.setting_value) currencySymbol = s.setting_value;
        if (s.setting_key === "meal_price" && s.setting_value) mealPrice = parseFloat(s.setting_value) || 150.0;
        if (s.setting_key === "it_support_phone" && s.setting_value) itSupportPhone = s.setting_value;
      }
    }
  } catch (_e) {
    const db = readDatabase();
    totalStaff = (db.people || []).filter((p: any) => p.is_active).length;
    mealsProcessed = (db.transactions || []).filter((t: any) => t.status === "completed").length;
  }

  const result: PublicStatsData = {
    success: true,
    totalStaff,
    mealsProcessed,
    companyName,
    companyTagline,
    companyLogoUrl,
    currencySymbol,
    mealPrice,
    itSupportPhone
  };

  cachedStats = { data: result, timestamp: Date.now() };
  return result;
}
