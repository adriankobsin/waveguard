import { useState, useMemo } from "react";
import LocationPicker from "@/components/location/LocationPicker";
import { useSiteLocations } from "@/contexts/SiteLocationsContext";
import { findLocationIds } from "@/lib/siteLocations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const CATEGORIES = ["Network", "Camera", "AV", "Server", "Power", "Other"];
const STATUSES = ["online", "offline", "warning", "unknown"];
const CONTROL_TYPES = ["none", "Crestron-CIP", "REST", "KNX", "GPIO", "RS-232"];
const AV_ROLES = ["none", "encoder", "decoder", "dsp", "display", "matrix"];

export function DeviceEditModal({ device, onSubmit, onClose }) {
  const { decks } = useSiteLocations();
  const initialLoc = useMemo(
    () => findLocationIds(decks, device.location || ""),
    [decks, device.location]
  );

  const [formData, setFormData] = useState({
    name: device.name || "",
    ip: device.ip || "",
    mac: device.mac || "",
    model: device.model || "",
    firmware: device.firmware || "",
    location: device.location || "",
    deckId: device.deckId || initialLoc.deckId,
    roomId: device.roomId || initialLoc.roomId,
    serial: device.serial || "",
    category: device.category || "Other",
    status: device.status || "unknown",
    controlType: device.controlType || "none",
    avRole: device.avRole || "none",
    notes: device.notes || "",
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Device name is required");
      return;
    }

    // Validate IP format (basic validation)
    if (formData.ip && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(formData.ip)) {
      toast.error("Invalid IP address format");
      return;
    }

    // Validate MAC format (basic validation)
    if (formData.mac && !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(formData.mac)) {
      toast.error("Invalid MAC address format. Use XX:XX:XX:XX:XX:XX");
      return;
    }

    onSubmit(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1c] border border-white/10 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Device</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Device Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g., SW-Bridge"
              />
            </div>
            <div>
              <Label className="text-slate-300">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0f1c] border border-white/10">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-white">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">IP Address</Label>
              <Input
                value={formData.ip}
                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                className="bg-white/5 border-white/10 text-white font-mono"
                placeholder="192.168.1.1"
              />
            </div>
            <div>
              <Label className="text-slate-300">MAC Address</Label>
              <Input
                value={formData.mac}
                onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
                className="bg-white/5 border-white/10 text-white font-mono"
                placeholder="00:1A:2B:3C:4D:5E"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g., Cisco CBS350"
              />
            </div>
            <div>
              <Label className="text-slate-300">Firmware Version</Label>
              <Input
                value={formData.firmware}
                onChange={(e) => setFormData({ ...formData, firmware: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g., 1.0.5.3"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 mb-2 block">Location (deck & room)</Label>
              <LocationPicker
                deckId={formData.deckId}
                roomId={formData.roomId}
                onChange={({ deckId, roomId, location }) =>
                  setFormData((f) => ({ ...f, deckId, roomId, location }))
                }
              />
            </div>
            <div>
              <Label className="text-slate-300">Serial Number</Label>
              <Input
                value={formData.serial}
                onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                className="bg-white/5 border-white/10 text-white font-mono"
                placeholder="e.g., FOC2241X0AB"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0f1c] border border-white/10">
                {STATUSES.map(status => (
                  <SelectItem key={status} value={status} className="text-white capitalize">
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Control type</Label>
              <Select
                value={formData.controlType}
                onValueChange={(value) => setFormData({ ...formData, controlType: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0f1c] border border-white/10">
                  {CONTROL_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-white">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">AV role</Label>
              <Select
                value={formData.avRole}
                onValueChange={(value) => setFormData({ ...formData, avRole: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0f1c] border border-white/10">
                  {AV_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-white">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Notes</Label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full min-h-[80px] bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              placeholder="Additional notes about this device..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-white/10">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-cyan-500 hover:bg-cyan-600">
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
