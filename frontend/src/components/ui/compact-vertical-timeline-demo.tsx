"use client";

import { CompactVerticalTimeline } from "./compact-vertical-timeline";

const sampleEvents = [
  {
    id: "1",
    time: "12:14",
    type: "Deployment",
    service: "payments-service",
    message: 'Rolled out revision 42',
  },
  {
    id: "2",
    time: "12:09",
    type: "Config",
    service: "payments-config",
    message: "ConfigMap updated",
  },
  {
    id: "3",
    time: "12:03",
    type: "Scaling",
    service: "payments-hpa",
    message: "Scaled 4 → 8 replicas",
  },
];

export function CompactVerticalTimelineDemo() {
  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
      <CompactVerticalTimeline events={sampleEvents} />
    </div>
  );
}
