import { useState } from "react";
import { X, Plus, Edit2, Trash2, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const COLORS = [
  { value: "cyan", class: "bg-cyan-500", border: "border-cyan-500/30" },
  { value: "blue", class: "bg-blue-500", border: "border-blue-500/30" },
  { value: "purple", class: "bg-purple-500", border: "border-purple-500/30" },
  { value: "green", class: "bg-green-500", border: "border-green-500/30" },
  { value: "yellow", class: "bg-yellow-500", border: "border-yellow-500/30" },
  { value: "orange", class: "bg-orange-500", border: "border-orange-500/30" },
  { value: "red", class: "bg-red-500", border: "border-red-500/30" },
  { value: "pink", class: "bg-pink-500", border: "border-pink-500/30" },
];

export function GroupManager({ devices, onGroupChange }) {
  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['deviceGroups'],
    queryFn: () => base44.entities.DeviceGroup.list(),
  });

  const createGroupMutation = useMutation({
    mutationFn: (data) => base44.entities.DeviceGroup.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceGroups'] });
      onGroupChange?.();
      toast.success("Group created");
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DeviceGroup.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceGroups'] });
      onGroupChange?.();
      toast.success("Group updated");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => base44.entities.DeviceGroup.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceGroups'] });
      onGroupChange?.();
      toast.success("Group deleted");
    },
  });

  const handleCreateGroup = (groupData) => {
    createGroupMutation.mutate(groupData);
    setOpen(false);
  };

  const handleUpdateGroup = (groupData) => {
    updateGroupMutation.mutate({ id: editingGroup.id, data: groupData });
    setEditingGroup(null);
  };

  const handleToggleCollapse = (group) => {
    updateGroupMutation.mutate({
      id: group.id,
      data: { collapsed: !group.collapsed },
    });
  };

  const handleRemoveDevice = (groupId, deviceId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    updateGroupMutation.mutate({
      id: groupId,
      data: {
        device_ids: group.device_ids.filter(id => id !== deviceId),
      },
    });
  };

  return (
    <>
      <div className="absolute top-4 right-4 z-10">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="gap-2 bg-secondary/90 border border-border hover:bg-muted"
            >
              <Users size={14} />
              Manage Groups
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-secondary border border-border max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Users size={16} />
                Device Groups
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {groups.length} group{groups.length !== 1 ? "s" : ""} · {devices.filter(d => groups.some(g => g.device_ids?.includes(d.id))).length} devices grouped
                </p>
                <CreateGroupButton
                  devices={devices}
                  groups={groups}
                  onSubmit={handleCreateGroup}
                />
              </div>

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading groups...</p>
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No groups yet. Create your first group to organize devices.</p>
              ) : (
                <div className="space-y-2">
                  {groups.map(group => {
                    const color = COLORS.find(c => c.value === group.color);
                    const groupedDevices = devices.filter(d => group.device_ids?.includes(d.id));
                    return (
                      <div
                        key={group.id}
                        className={`rounded-xl border ${color.border} bg-muted p-3`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${color.class}`} />
                            <p className="text-sm font-semibold text-foreground">{group.name}</p>
                            {group.description && (
                              <span className="text-xs text-muted-foreground">· {group.description}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleToggleCollapse(group)}
                            >
                              {group.collapsed ? "▼" : "▲"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingGroup(group)}
                            >
                              <Edit2 size={12} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                              onClick={() => deleteGroupMutation.mutate(group.id)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                        {!group.collapsed && groupedDevices.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            {groupedDevices.map(device => (
                              <Badge
                                key={device.id}
                                variant="outline"
                                className="gap-1 bg-secondary border-border"
                              >
                                {device.name}
                                <button
                                  onClick={() => handleRemoveDevice(group.id, device.id)}
                                  className="hover:text-red-400"
                                >
                                  <X size={10} />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        {!group.collapsed && groupedDevices.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-2">No devices in this group</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          devices={devices}
          groups={groups}
          onSubmit={handleUpdateGroup}
          onClose={() => setEditingGroup(null)}
        />
      )}
    </>
  );
}

function CreateGroupButton({ devices, groups, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "cyan",
    icon: "other",
    device_ids: [],
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    onSubmit(formData);
    setOpen(false);
    setFormData({
      name: "",
      description: "",
      color: "cyan",
      icon: "other",
      device_ids: [],
    });
  };

  const ungroupedDevices = devices.filter(d =>
    !groups.some(g => g.device_ids?.includes(d.id))
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1 h-8">
          <Plus size={14} />
          New Group
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-secondary border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create Device Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-secondary-foreground">Group Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Bridge Devices"
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-secondary-foreground">Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-secondary-foreground">Color</Label>
            <div className="flex items-center gap-2 mt-1">
              {COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`w-6 h-6 rounded-full ${color.class} ${
                    formData.color === color.value ? "ring-2 ring-white" : ""
                  }`}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-secondary-foreground">Devices</Label>
            <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
              {ungroupedDevices.map(device => (
                <label
                  key={device.id}
                  className="flex items-center gap-2 text-sm text-secondary-foreground cursor-pointer hover:bg-secondary p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={formData.device_ids.includes(device.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          device_ids: [...prev.device_ids, device.id],
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          device_ids: prev.device_ids.filter(id => id !== device.id),
                        }));
                      }
                    }}
                    className="rounded border-border"
                  />
                  {device.name}
                </label>
              ))}
              {ungroupedDevices.length === 0 && (
                <p className="text-xs text-muted-foreground">All devices are already grouped</p>
              )}
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            className="w-full bg-cyan-500 hover:bg-cyan-600"
            disabled={!formData.name.trim()}
          >
            Create Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditGroupModal({ group, devices, groups: _groups, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description || "",
    color: group.color,
    icon: group.icon,
    device_ids: group.device_ids || [],
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-secondary border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-secondary-foreground">Group Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-secondary-foreground">Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-secondary-foreground">Color</Label>
            <div className="flex items-center gap-2 mt-1">
              {COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`w-6 h-6 rounded-full ${color.class} ${
                    formData.color === color.value ? "ring-2 ring-white" : ""
                  }`}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-secondary-foreground">Devices</Label>
            <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
              {devices.map(device => (
                <label
                  key={device.id}
                  className="flex items-center gap-2 text-sm text-secondary-foreground cursor-pointer hover:bg-secondary p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={formData.device_ids.includes(device.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          device_ids: [...prev.device_ids, device.id],
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          device_ids: prev.device_ids.filter(id => id !== device.id),
                        }));
                      }
                    }}
                    className="rounded border-border"
                  />
                  {device.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
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
