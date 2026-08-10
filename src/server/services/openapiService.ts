export function getOpenApiSpec() {
  return {
    openapi: "3.0.0",
    info: {
      title: "DGMC Meal Management & Dining Portal API",
      version: "1.0.0",
      description: "Enterprise REST API for managing meal allowances, cashier POS scans, employee scheduling, audit trails, and AI diagnostics."
    },
    servers: [
      {
        url: "/api",
        description: "API Base Path"
      }
    ],
    paths: {
      "/health": {
        get: {
          summary: "System Health Check",
          description: "Returns server uptime, connection pool status, and database health metrics.",
          responses: {
            "200": {
              description: "System healthy"
            }
          }
        }
      },
      "/auth/login": {
        post: {
          summary: "User Authentication",
          description: "Authenticate staff or admin credentials and return JWT token + user profile.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    password: { type: "string" }
                  },
                  required: ["username", "password"]
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Login successful"
            },
            "401": {
              description: "Invalid credentials"
            }
          }
        }
      },
      "/cashier/scan": {
        post: {
          summary: "Process Meal Swipe Scan",
          description: "Scan employee QR code or ID to process meal allowance or paid swipe.",
          responses: {
            "200": {
              description: "Scan processed successfully"
            }
          }
        }
      },
      "/admin/sys-health": {
        get: {
          summary: "System Diagnostics and Cache Metrics",
          description: "Retrieve cache hit rates, MySQL pool status, and performance logs.",
          responses: {
            "200": {
              description: "Diagnostics retrieved"
            }
          }
        }
      }
    }
  };
}
