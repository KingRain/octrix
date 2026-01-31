import { Router, Request, Response } from "express";
import { kubernetesService } from "../services/kubernetes.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("cluster-routes");
const router = Router();

router.get("/nodes", async (_req: Request, res: Response) => {
  try {
    const nodes = await kubernetesService.getNodes();
    res.json({ success: true, data: nodes });
  } catch (error) {
    logger.error({ error }, "Failed to get nodes");
    res.status(500).json({ success: false, message: "Failed to get nodes" });
  }
});

router.get("/pods", async (req: Request, res: Response) => {
  try {
    const namespace = req.query.namespace as string | undefined;
    const pods = await kubernetesService.getPods(namespace);
    res.json({ success: true, data: pods });
  } catch (error) {
    logger.error({ error }, "Failed to get pods");
    res.status(500).json({ success: false, message: "Failed to get pods" });
  }
});

router.delete("/pods/:namespace/:name", async (req: Request, res: Response) => {
  try {
    const { namespace, name } = req.params;
    await kubernetesService.deletePod(namespace, name);
    res.json({ success: true, message: "Pod deleted" });
  } catch (error) {
    logger.error({ error }, "Failed to delete pod");
    res.status(500).json({ success: false, message: "Failed to delete pod" });
  }
});

router.post("/pods/restart-all", async (_req: Request, res: Response) => {
  try {
    const pods = await kubernetesService.getPods();
    const deletePromises = pods.map((pod) => 
      kubernetesService.deletePod(pod.namespace, pod.name)
    );
    
    await Promise.allSettled(deletePromises);
    
    const deleted = deletePromises.filter((_, index) => 
      pods[index].name
    ).length;
    
    res.json({ 
      success: true, 
      message: `Restarted ${deleted} pods`, 
      data: { deleted } 
    });
  } catch (error) {
    logger.error({ error }, "Failed to restart all pods");
    res.status(500).json({ success: false, message: "Failed to restart all pods" });
  }
});

router.get("/services", async (req: Request, res: Response) => {
  try {
    const namespace = req.query.namespace as string | undefined;
    const services = await kubernetesService.getServices(namespace);
    res.json({ success: true, data: services });
  } catch (error) {
    logger.error({ error }, "Failed to get services");
    res.status(500).json({ success: false, message: "Failed to get services" });
  }
});

router.get("/namespaces", async (_req: Request, res: Response) => {
  try {
    const namespaces = await kubernetesService.getNamespaces();
    res.json({ success: true, data: namespaces });
  } catch (error) {
    logger.error({ error }, "Failed to get namespaces");
    res.status(500).json({ success: false, message: "Failed to get namespaces" });
  }
});

router.post("/nodes/:name/cordon", async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    await kubernetesService.cordonNode(name);
    res.json({ success: true, message: "Node cordoned" });
  } catch (error) {
    logger.error({ error }, "Failed to cordon node");
    res.status(500).json({ success: false, message: "Failed to cordon node" });
  }
});

router.post("/nodes/:name/uncordon", async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    await kubernetesService.uncordonNode(name);
    res.json({ success: true, message: "Node uncordoned" });
  } catch (error) {
    logger.error({ error }, "Failed to uncordon node");
    res.status(500).json({ success: false, message: "Failed to uncordon node" });
  }
});

router.post("/deployments/:namespace/:name/scale", async (req: Request, res: Response) => {
  try {
    const { namespace, name } = req.params;
    const { replicas } = req.body;
    await kubernetesService.scaleDeployment(namespace, name, replicas);
    res.json({ success: true, message: "Deployment scaled" });
  } catch (error) {
    logger.error({ error }, "Failed to scale deployment");
    res.status(500).json({ success: false, message: "Failed to scale deployment" });
  }
});

export default router;
