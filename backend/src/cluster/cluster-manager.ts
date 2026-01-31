import { config } from "../config/index.js";

export interface Cluster {
  id: string;
  name: string;
  prometheusUrl: string;
  kubeConfigPath?: string;
  k8sContext?: string;
}

class ClusterManager {
  private clusters: Cluster[] = config.clusters;
  private currentClusterId: string = this.clusters[0]?.id || "cluster-1";

  getClusters(): Cluster[] {
    return this.clusters;
  }

  getCluster(id: string): Cluster | undefined {
    return this.clusters.find((c) => c.id === id);
  }

  getCurrentCluster(): Cluster {
    const cluster = this.getCluster(this.currentClusterId);
    if (!cluster) {
      throw new Error(`Cluster ${this.currentClusterId} not found`);
    }
    return cluster;
  }

  setCurrentCluster(id: string): void {
    const cluster = this.getCluster(id);
    if (!cluster) {
      throw new Error(`Cluster ${id} not found`);
    }
    this.currentClusterId = id;
  }

  addCluster(cluster: Omit<Cluster, "id">): Cluster {
    const newCluster: Cluster = {
      ...cluster,
      id: `cluster-${Date.now()}`,
    };
    this.clusters.push(newCluster);
    return newCluster;
  }

  removeCluster(id: string): boolean {
    const index = this.clusters.findIndex((c) => c.id === id);
    if (index === -1) return false;
    
    this.clusters.splice(index, 1);
    
    // If we removed the current cluster, switch to the first available
    if (this.currentClusterId === id && this.clusters.length > 0) {
      this.currentClusterId = this.clusters[0].id;
    }
    
    return true;
  }
}

export const clusterManager = new ClusterManager();
