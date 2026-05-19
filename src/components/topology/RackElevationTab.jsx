import RackDesigner from "./RackDesigner";

export default function RackElevationTab({ topologyData, onRefresh }) {
  return <RackDesigner topologyDevices={topologyData?.devices || []} onRefresh={onRefresh} />;
}
