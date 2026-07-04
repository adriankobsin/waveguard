export default function HVACEmptyState({ onRefresh }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/8 border border-cyan-500/15 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-cyan-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h3M8 16V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v10M8 16h8m0 0a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2m8 0V8a2 2 0 0 1 2-2h3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3m-6 4h6" />
        </svg>
      </div>
      <p className="text-base font-semibold text-foreground mb-1">No HVAC zones available</p>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        HVAC zones will appear here once configured. Add zone definitions to the HVAC config or start the mock server.
      </p>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
