import { Filter, X } from "lucide-react";
import {
  EMPTY_INVENTORY_FILTERS,
  countActiveInventoryFilters,
} from "@/lib/inventory/inventoryFilters";

function FilterSelect({ label, value, onChange, options, disabled }) {
  if (!options?.length) return null;

  return (
    <label className="flex flex-col gap-0.5 min-w-[120px] flex-1 sm:flex-initial sm:max-w-[180px]">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        <option value="All">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function InventoryFilters({
  filters,
  onChange,
  options,
  disabled = false,
  resultCount,
  totalCount,
}) {
  const activeCount = countActiveInventoryFilters(filters);

  /** Patch one field; parent merges with EMPTY_INVENTORY_FILTERS defaults. */
  const set = (key) => (val) => onChange({ [key]: val });

  const clearAll = () => onChange({ ...EMPTY_INVENTORY_FILTERS });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground pb-1.5 flex-shrink-0">
          <Filter size={13} />
          <span className="text-xs font-medium">Filters</span>
          {activeCount > 0 && (
            <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>

        <FilterSelect
          label="Category"
          value={filters.category ?? "All"}
          onChange={set("category")}
          options={options.categories}
          disabled={disabled}
        />
        <FilterSelect
          label="Make"
          value={filters.make ?? "All"}
          onChange={set("make")}
          options={options.makes}
          disabled={disabled}
        />
        <FilterSelect
          label="Model"
          value={filters.model ?? "All"}
          onChange={set("model")}
          options={options.models}
          disabled={disabled}
        />
        <FilterSelect
          label="System"
          value={filters.system ?? "All"}
          onChange={set("system")}
          options={options.systems}
          disabled={disabled}
        />
        <FilterSelect
          label="Area / deck"
          value={filters.area ?? "All"}
          onChange={set("area")}
          options={options.areas}
          disabled={disabled}
        />
        <FilterSelect
          label="Room"
          value={filters.room ?? "All"}
          onChange={set("room")}
          options={options.rooms}
          disabled={disabled}
        />
        <FilterSelect
          label="Floor code"
          value={filters.floor ?? "All"}
          onChange={set("floor")}
          options={options.floors}
          disabled={disabled}
        />
        <FilterSelect
          label="Condition"
          value={filters.condition ?? "All"}
          onChange={set("condition")}
          options={options.conditions}
          disabled={disabled}
        />
        <FilterSelect
          label="Status"
          value={filters.status ?? "All"}
          onChange={set("status")}
          options={options.statuses}
          disabled={disabled}
        />

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="flex items-center gap-1 px-2.5 py-1.5 mb-0.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {resultCount} shown
        {totalCount !== resultCount ? ` of ${totalCount}` : ""} in equipment
        {activeCount > 0 ? ` · ${activeCount} filter${activeCount !== 1 ? "s" : ""} active` : ""}
      </p>
    </div>
  );
}
