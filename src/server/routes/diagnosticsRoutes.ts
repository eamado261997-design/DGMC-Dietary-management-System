import { Router } from "express";
import { DiagnosticsController } from "../controllers/diagnosticsController.js";

export function createDiagnosticsRouter(getBenchmarkLogs: () => any[], requireRole: (roles: string[]) => boolean) {
  const router = Router();
  const controller = new DiagnosticsController(getBenchmarkLogs);

  router.get("/admin/diagnostics", async (req, res) => {
    await controller.getDiagnostics(req, res);
  });

  router.post("/admin/diagnostics/cache/clear", async (req, res) => {
    await controller.clearCache(req, res);
  });

  router.post("/admin/diagnostics/failover/trigger", async (req, res) => {
    await controller.failover(req, res);
  });

  router.post("/admin/diagnostics/failover/recover", async (req, res) => {
    await controller.recover(req, res);
  });

  return router;
}
