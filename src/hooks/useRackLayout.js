import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { loadDefaultRackLayout, saveRackLayout } from "@/api/topologyApi";
import {
  buildEquipmentMap,
  placementToRackItem,
  computeRackSummary,
} from "@/lib/topology/equipmentCatalog";

const EMPTY_LAYOUT = {
  id: null,
  name: "Unsaved layout",
  is_default: true,
  racks: [],
  placements: [],
};

export function useRackLayout(catalogDevices) {
  const [layout, setLayout] = useState(EMPTY_LAYOUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const warnedRef = useRef(false);

  const catalog = useMemo(
    () => buildEquipmentMap(catalogDevices || []),
    [catalogDevices]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { layout: data, warning } = await loadDefaultRackLayout();
      setLayout(data ? { ...EMPTY_LAYOUT, ...data } : { ...EMPTY_LAYOUT });
      if (warning) {
        setLoadError(warning);
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.warning(warning);
        }
      } else {
        warnedRef.current = false;
      }
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "Failed to load rack layout");
      setLayout({ ...EMPTY_LAYOUT });
      toast.error(err.message || "Failed to load rack layout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const itemsByRack = useCallback(() => {
    const map = {};
    (layout?.racks || []).forEach((r) => {
      map[r.id] = [];
    });
    (layout?.placements || []).forEach((p) => {
      const item = placementToRackItem(p, catalog);
      if (item && map[p.rackId]) map[p.rackId].push(item);
    });
    return map;
  }, [layout, catalog]);

  const racksWithSummary = useCallback(() => {
    const byRack = itemsByRack();
    return (layout?.racks || []).map((rack) => {
      const items = byRack[rack.id] || [];
      const { watts, tempC, usedWatts } = computeRackSummary(items, rack.watts || 500);
      return { ...rack, items, watts, tempC, usedWatts };
    });
  }, [layout, itemsByRack]);

  const save = useCallback(async (nextLayout) => {
    setSaving(true);
    try {
      const payload = {
        ...nextLayout,
        is_default: true,
        name: nextLayout.name || "Default vessel layout",
      };
      const { layout: saved, warning } = await saveRackLayout(payload);
      setLayout(saved ? { ...EMPTY_LAYOUT, ...saved } : payload);
      if (warning) {
        toast.warning(warning);
      } else {
        toast.success("Rack layout saved");
      }
      return saved;
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save rack layout");
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateLayout = useCallback((updater) => {
    setLayout((prev) => {
      const base = prev || EMPTY_LAYOUT;
      return typeof updater === "function" ? updater(base) : updater;
    });
  }, []);

  return {
    layout,
    loading,
    saving,
    loadError,
    catalog,
    itemsByRack,
    racksWithSummary,
    save,
    updateLayout,
    reload: load,
  };
}
