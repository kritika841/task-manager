import type { DensityMode, ViewMode } from "./types";

export interface WorkspaceSettings {
  adflowSyncEnabled: boolean | null;
  defaultView: ViewMode | null;
  density: DensityMode | null;
}
