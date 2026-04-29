import { useEffect, useCallback } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { api } from '../services/api';

// Removed hard-coded mapErrorToMitigation function

// ─── Hook ────────────────────────────────────────────────────────────────────
export const useSimulation = () => {
  const pollInterval = useSimulationStore(state => state.pollInterval);
  const batchStage = useSimulationStore(state => state.batchStage);
  const setBatchStage = useSimulationStore(state => state.setBatchStage);
  const setNodes = useSimulationStore(state => state.setNodes);
  const isSimulating = useSimulationStore(state => state.isSimulating);
  const setIsSimulating = useSimulationStore(state => state.setIsSimulating);
  const tick = useSimulationStore(state => state.tick);
  const setTick = useSimulationStore(state => state.setTick);
  const setActiveMitigation = useSimulationStore(state => state.setActiveMitigation);

  const toggleSimulation = useCallback(async () => {
    const nextIsSimulating = !isSimulating;
    if (nextIsSimulating) {
      api.startSimulation();
    } else {
      api.stopSimulation();
    }
    setIsSimulating(nextIsSimulating);
  }, [isSimulating, setIsSimulating]);

  const resetSimulation = useCallback(async () => {
    await api.resetState();
    await api.stopSimulation();
    setIsSimulating(false);
    setTick(0);
    setBatchStage('setup');
    setActiveMitigation(null);
    const newState = await api.getState();
    setNodes(newState.nodes || []);
    useSimulationStore.setState({
      inventory: newState.inventory || [],
      edges: newState.edges || [],
      globalAlerts: [],
      batchStage: 'setup',
      simulationHistory: [],
      tick: 0,
      recipe: newState.recipe || useSimulationStore.getState().recipe,
      cumulativeEnergyCost: 0,
      bottleneckNodeIds: [],
    });
  }, [setBatchStage, setNodes, setIsSimulating, setTick, setActiveMitigation]);

  // ─── Polling Loop with Safety Interlock ───────────────────────────────
  useEffect(() => {
    let timeoutId: number | undefined;
    let cancelled = false;
    let inFlight = false;

    if (isSimulating) {
      const runTick = async () => {
        if (cancelled || inFlight) return;
        inFlight = true;
        try {
          // In simulation mode, we call .tick() to advance physics AND get state.
          // In non-simulation mode, we'd just call .getState() if needed.
          const backendState = await api.tick();
          useSimulationStore.getState().setIsBackendConnected(true);

          // ── Alert Logging (no stop) ─────────────────────────────────────
          // Critical alerts are surfaced in the Alert Matrix and Production Logs.
          // Simulation continues running; mitigations are applied automatically.
          const criticalError = backendState.alerts?.find(
            (a: any) => a.type === 'error'
          );

          if (criticalError) {
            console.warn(`[ALERT] ${criticalError.message} (node: ${criticalError.nodeId ?? 'system'}) — simulation continues`);

            // Fetch AI mitigation in the background and apply it automatically
            api.getAiMitigation(criticalError.message, criticalError.nodeId)
              .then((mitigation: any) => {
                if (mitigation) {
                  setActiveMitigation(mitigation);
                  // Auto-apply the mitigation so the plant self-heals
                  api.mitigate(mitigation.action, mitigation.nodeId)
                    .catch((err: unknown) => console.error('Auto-mitigation apply failed:', err));
                }
              })
              .catch((err: unknown) => console.error('Failed to get AI mitigation:', err));
          }

          // ── Sync State to Frontend ────────────────────────────────────
          const currentHistory = useSimulationStore.getState().simulationHistory || [];
          const nextHistory = backendState.simulationHistory
            || (backendState.history
              ? [...currentHistory, backendState.history].slice(-50)
              : currentHistory);

          setTick(backendState.tick);
          setNodes(backendState.nodes || []);
          useSimulationStore.setState({
            inventory: backendState.inventory || [],
            edges: backendState.edges || [],
            globalAlerts: backendState.alerts || [],
            batchStage: backendState.batchStage || 'setup',
            simulationHistory: nextHistory,
            recipe: backendState.recipe || useSimulationStore.getState().recipe,
            cumulativeEnergyCost: typeof backendState.cumulativeEnergyCost === 'number'
              ? backendState.cumulativeEnergyCost
              : useSimulationStore.getState().cumulativeEnergyCost,
            bottleneckNodeIds: Array.isArray(backendState.bottleneckNodeIds)
              ? backendState.bottleneckNodeIds
              : useSimulationStore.getState().bottleneckNodeIds,
          });

          // Phase 3 — refresh recommendations every tick (non-blocking, fire-and-forget)
          useSimulationStore.getState().refreshRecommendations();

        } catch (e) {
          console.error('Failed to sync state from backend:', e);
          useSimulationStore.getState().setIsBackendConnected(false);
          // Auto stop if connection is lost
          setIsSimulating(false);
        } finally {
          inFlight = false;
          if (!cancelled && isSimulating) {
            timeoutId = window.setTimeout(runTick, pollInterval);
          }
        }
      };

      runTick();
    }

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [isSimulating, setNodes, setTick, pollInterval, setIsSimulating, setActiveMitigation]);

  return {
    isSimulating,
    tick,
    batchStage,
    toggleSimulation,
    resetSimulation,
  };
};
