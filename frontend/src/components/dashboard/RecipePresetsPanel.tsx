/**
 * Phase 4 — RecipePresetsPanel
 * Save and load named recipe configurations using localStorage.
 * Intended to be rendered inside SettingsView as a collapsible panel.
 */
import { useEffect, useState } from 'react';
import { FaSave, FaFolderOpen, FaTrash, FaLock, FaLockOpen } from 'react-icons/fa';
import { useSimulationStore } from '../../store/simulationStore';
import type { RecipeConfig } from '../../types';

const STORAGE_KEY = 'autonex_recipe_presets';

type Preset = {
  id: string;
  name: string;
  savedAt: string;
  recipe: RecipeConfig;
};

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Preset[]) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export default function RecipePresetsPanel() {
  const recipe      = useSimulationStore(s => s.recipe);
  const setRecipe   = useSimulationStore(s => s.setRecipe);
  const isRunning   = useSimulationStore(s => s.isSimulating);

  const [presets, setPresets]     = useState<Preset[]>([]);
  const [newName, setNewName]     = useState('');
  const [message, setMessage]     = useState<string | null>(null);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = () => {
    const name = newName.trim();
    if (!name) return;
    const preset: Preset = {
      id: `preset-${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      recipe: { ...recipe },
    };
    const updated = [preset, ...presets.filter(p => p.name !== name)];
    setPresets(updated);
    savePresets(updated);
    setNewName('');
    flash(`Saved "${name}"`);
  };

  const handleLoad = (preset: Preset) => {
    if (isRunning) { flash('Simulation is running — stop it before loading a preset.'); return; }
    setRecipe(preset.recipe);
    flash(`Loaded "${preset.name}"`);
  };

  const handleDelete = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    savePresets(updated);
  };

  return (
    <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
      {/* header */}
      <div className="flex items-center gap-2 mb-3">
        <FaSave className="text-sky-400" />
        <span className="text-white text-sm font-semibold">Recipe Presets</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-yellow-400">
            <FaLock size={10} /> Recipe locked while simulating
          </span>
        )}
        {!isRunning && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
            <FaLockOpen size={10} /> Editable
          </span>
        )}
      </div>

      {/* save new preset */}
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
          placeholder="Preset name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          disabled={isRunning}
        />
        <button
          onClick={handleSave}
          disabled={isRunning || !newName.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-sky-600/80 hover:bg-sky-600 disabled:opacity-40 text-white text-sm rounded-lg transition"
        >
          <FaSave size={11} /> Save
        </button>
      </div>

      {/* flash message */}
      {message && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-emerald-900/20 text-emerald-300 text-xs border border-emerald-500/20">
          {message}
        </div>
      )}

      {/* preset list */}
      {presets.length === 0 ? (
        <p className="text-gray-600 text-xs text-center py-3">No saved presets yet.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {presets.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{p.name}</div>
                <div className="text-[10px] text-gray-500 flex gap-2 flex-wrap mt-0.5">
                  <span>DVB {p.recipe.dvbPercent}%</span>
                  <span>Init {p.recipe.initiatorDosage}</span>
                  <span>M:W {p.recipe.monomerWaterRatio}</span>
                  <span>{p.recipe.feedRateProfile}</span>
                </div>
              </div>
              <button
                onClick={() => handleLoad(p)}
                title="Load preset"
                className="p-1.5 rounded bg-emerald-700/30 hover:bg-emerald-700/60 text-emerald-400 transition"
              >
                <FaFolderOpen size={11} />
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                title="Delete preset"
                className="p-1.5 rounded bg-red-700/20 hover:bg-red-700/50 text-red-400 transition"
              >
                <FaTrash size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
