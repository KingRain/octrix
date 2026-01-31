import { create } from "zustand";
import type {
  Cluster,
  Node,
  Pod,
  Service,
  Deployment,
  Namespace,
  Alert,
} from "@/types";

interface ClusterState {
  clusters: Cluster[];
  selectedCluster: Cluster | null;
  nodes: Node[];
  pods: Pod[];
  services: Service[];
  deployments: Deployment[];
  namespaces: Namespace[];
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;

  setSelectedCluster: (cluster: Cluster | null) => void;
  setClusters: (clusters: Cluster[]) => void;
  setNodes: (nodes: Node[]) => void;
  setPods: (pods: Pod[]) => void;
  setServices: (services: Service[]) => void;
  setDeployments: (deployments: Deployment[]) => void;
  setNamespaces: (namespaces: Namespace[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  acknowledgeAlert: (alertId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useClusterStore = create<ClusterState>((set) => ({
  clusters: [],
  selectedCluster: null,
  nodes: [],
  pods: [],
  services: [],
  deployments: [],
  namespaces: [],
  alerts: [],
  isLoading: false,
  error: null,

  setSelectedCluster: (cluster) => set({ selectedCluster: cluster }),
  setClusters: (clusters) => set({ clusters }),
  setNodes: (nodes) => set({ nodes }),
  setPods: (pods) => set({ pods }),
  setServices: (services) => set({ services }),
  setDeployments: (deployments) => set({ deployments }),
  setNamespaces: (namespaces) => set({ namespaces }),
  setAlerts: (alerts) => set({ alerts }),
  acknowledgeAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
