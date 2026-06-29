import { useState, useMemo } from "react";
import LocationPicker from "@/components/location/LocationPicker";
import { useSiteLocations } from "@/contexts/SiteLocationsContext";
import { findLocationIds } from "@/lib/siteLocations";
import { getEquipmentMake } from "@/lib/inventory/inventoryFilters";
import {
  DEVICE_CATEGORIES,
  DEVICE_CONTROL_TYPES,
  DEVICE_STATUSES,
} from "@/lib/equipment/deviceFormConstants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function categoryOptions(deviceCategory) {
  const set = new Set(DEVICE_CATEGORIES);
  if (deviceCategory && !set.has(deviceCategory)) {
    set.add(deviceCategory);
  }
  return [...set];
}

function controlTypeOptions(deviceControlType) {
  const set = new Set(DEVICE_CONTROL_TYPES);
  if (deviceControlType && !set.has(deviceControlType)) {
    set.add(deviceControlType);
  }
  return [...set];
}

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
    make: device.make || getEquipmentMake(device) || "",
    model: device.model || "",
    firmware: device.firmware || "",
    location: device.location || "",
    deckId: device.deckId || initialLoc.deckId,
    roomId: device.roomId || initialLoc.roomId,
    serial: device.serial || "",
    category: device.category || "Other",
    status: device.status || "unknown",
    controlType: device.controlType || "none",
    notes: device.notes || "",
  });

  const categories = useMemo(() => categoryOptions(formData.category), [formData.category]);
  const controlTypes = useMemo(() => controlTypeOptions(formData.controlType), [formData.controlType]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Device name is required");
      return;
    }

    if (formData.ip && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(formData.ip)) {
      toast.error("Invalid IP address format");
      return;
    }

    if (formData.mac && !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(formData.mac)) {
      toast.error("Invalid MAC address format. Use XX:XX:XX:XX:XX:XX");
      return;
    }

    onSubmit(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-secondary border border-border max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Device</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-secondary-foreground">Device Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-secondary border-border text-foreground"
                placeholder="e.g., SW-Bridge"
              />
            </div>
            <div>
              <Label className="text-secondary-foreground">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-secondary border border-border max-h-60">
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-foreground">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-secondary-foreground">IP Address</Label>
              <Input
                value={formData.ip}
                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                className="bg-secondary border-border text-foreground font-mono"
                placeholder="192.168.1.1"
              />
            </div>
            <div>
              <Label className="text-secondary-foreground">MAC Address</Label>
              <Input
                value={formData.mac}
                onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
                className="bg-secondary border-border text-foreground font-mono"
                placeholder="00:1A:2B:3C:4D:5E"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-secondary-foreground">Make</Label>
              <Input
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                className="bg-secondary border-border text-foreground"
                placeholder="e.g., Cisco, Crestron, Axis"
              />
            </div>
            <div>
              <Label className="text-secondary-foreground">Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="bg-secondary border-border text-foreground"
                placeholder="e.g., CBS350-24P"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-secondary-foreground">Firmware Version</Label>
              <Input
                value={formData.firmware}
                onChange={(e) => setFormData({ ...formData, firmware: e.target.value })}
                className="bg-secondary border-border text-foreground"
                placeholder="e.g., 1.0.5.3"
              />
            </div>
            <div>
              <Label className="text-secondary-foreground">Serial Number</Label>
              <Input
                value={formData.serial}
                onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                className="bg-secondary border-border text-foreground font-mono"
                placeholder="e.g., FOC2241X0AB"
              />
            </div>
          </div>

          <div>
            <Label className="text-secondary-foreground mb-2 block">Location (deck & room)</Label>
            <LocationPicker
              deckId={formData.deckId}
              roomId={formData.roomId}
              onChange={({ deckId, roomId, location }) =>
                setFormData((f) => ({ ...f, deckId, roomId, location }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-secondary-foreground">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-secondary border border-border">
                  {DEVICE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status} className="text-foreground capitalize">
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-secondary-foreground">Control type</Label>
              <Select
                value={formData.controlType}
                onValueChange={(value) => setFormData({ ...formData, controlType: value })}
              >
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-secondary border border-border max-h-60">
                  {controlTypes.map((t) => (
                    <SelectItem key={t} value={t} className="text-foreground">
                      {t === "none" ? "None" : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-secondary-foreground">Notes</Label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full min-h-[80px] bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              placeholder="Additional notes about this device..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-border">
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
