/**
 * Retrieves a cookie value by name.
 * 
 * @param name - The name of the cookie
 * @returns The cookie value or an empty string if not found
 */
export function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }
  
  return "";
}
