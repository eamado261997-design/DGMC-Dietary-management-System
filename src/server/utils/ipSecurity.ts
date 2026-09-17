import { logger } from "./logger.js";

/**
 * Validates if an incoming IP address is allowed to access internal telemetry endpoints.
 * It checks against localhost, Docker default subnets, and an optional ALLOWED_INTERNAL_IPS env var.
 * @param clientIp The IP address of the incoming request
 * @returns boolean True if allowed, false if blocked
 */
export function isInternalIpAllowed(clientIp: string): boolean {
  if (!clientIp) return false;

  // 1. Check strict localhost
  const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  if (isLocalhost) return true;

  // 2. Check Docker internal networking subnets (usually 172.16.0.0/12)
  const isDockerNet = clientIp.startsWith('172.') || clientIp.startsWith('::ffff:172.');
  if (isDockerNet) return true;

  // 3. Check configurable environment variable list (comma separated)
  // Example: ALLOWED_INTERNAL_IPS="192.168.1.50,10.0.0.5"
  const allowedIpsEnv = process.env.ALLOWED_INTERNAL_IPS;
  if (allowedIpsEnv) {
    const allowedList = allowedIpsEnv.split(',').map(ip => ip.trim());
    
    // Exact match or subnet match (basic string prefixing for simplicity)
    const matchesConfig = allowedList.some(allowedIp => {
      if (clientIp === allowedIp || clientIp === `::ffff:${allowedIp}`) return true;
      // Allow wildcard subnet matching like "192.168.1."
      if (allowedIp.endsWith('.') && (clientIp.startsWith(allowedIp) || clientIp.startsWith(`::ffff:${allowedIp}`))) return true;
      return false;
    });

    if (matchesConfig) return true;
  }

  return false;
}
