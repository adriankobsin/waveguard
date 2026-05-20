import { useState, useCallback, useMemo } from "react";

export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);

  const count = selectedIds.size;

  const allSelected = useCallback(
    (ids) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const someSelected = useCallback(
    (ids) => ids.some((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const toggleAll = useCallback(
    (ids) => {
      if (ids.every((id) => selectedIds.has(id))) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(ids));
      }
    },
    [selectedIds]
  );

  return useMemo(
    () => ({
      selectedIds,
      count,
      toggle,
      selectAll,
      clear,
      isSelected,
      allSelected,
      someSelected,
      toggleAll,
    }),
    [selectedIds, count, toggle, selectAll, clear, isSelected, allSelected, someSelected, toggleAll]
  );
}
