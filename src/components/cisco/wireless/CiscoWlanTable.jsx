export default function CiscoWlanTable({ wlans = [] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="px-4 py-2.5 font-bold">SSID</th>
            <th className="px-4 py-2.5 font-bold hidden md:table-cell">Security</th>
            <th className="px-4 py-2.5 font-bold hidden lg:table-cell">VLAN</th>
            <th className="px-4 py-2.5 font-bold hidden lg:table-cell">Subnet</th>
            <th className="px-4 py-2.5 font-bold hidden xl:table-cell">Policy</th>
          </tr>
        </thead>
        <tbody>
          {wlans.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                No WLANs returned from the controller.
              </td>
            </tr>
          ) : (
            wlans.map((w) => (
              <tr key={w.wlanId ?? w.profileName} className="border-b border-border/60">
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{w.ssid}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {w.profileName}
                    {!w.enabled && (
                      <span className="ml-2 text-amber-400 font-bold">DISABLED</span>
                    )}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs hidden md:table-cell">
                  {w.securitySummary || "—"}
                </td>
                <td className="px-4 py-3 text-xs hidden lg:table-cell">
                  {w.vlanId != null ? `Vlan${w.vlanId}` : w.vlanName || "—"}
                </td>
                <td className="px-4 py-3 text-xs font-mono hidden lg:table-cell">
                  {w.subnetCidr ? (
                    <span>
                      {w.subnetCidr}
                      {w.interfaceIp && (
                        <span className="block text-[10px] text-muted-foreground mt-0.5">
                          GW {w.interfaceIp}
                        </span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-xs hidden xl:table-cell">
                  {w.policyProfile || "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
