import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/permissions";

export function useTopologyAdmin() {
  const { user } = useAuth();
  const canEdit = isAdmin(user);
  return { user, canEdit, isAdmin: canEdit };
}
