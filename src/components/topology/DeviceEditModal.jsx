import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const CATEGORIES = ["Network", "Camera", "AV", "Server", "Power", "Other"];
const STATUSES = ["online", "offline", "warning", "unknown"];

export function DeviceEditModal({ device, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: device.name || "",
    ip: device.ip || "",
    mac: device.mac || "",
    model: device.model || "",
    firmware: device.firmware || "",
    location: device.location || "",
    serial: device.serial || "",
    category: device.category || "Other",
    status: device.status || "unknown",
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
    toast.success("Device updated successfully");
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g., Bridge Rack"
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