import ScenesPanel from "@/components/lighting/ScenesPanel";

// Thin wrapper so the legacy /scenes route keeps working as a direct
// deep-link. The actual UI lives in `ScenesPanel` so the Lights and
// Shades page can render the same panel as one of its tabs.
export default function ScenesPage() {
  return <ScenesPanel />;
}
