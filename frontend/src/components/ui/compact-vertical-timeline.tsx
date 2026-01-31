"use client";

export interface TimelineEvent {
  id: string;
  time: string;
  type: string;
  service: string;
  message: string;
}

interface CompactVerticalTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function CompactVerticalTimeline({ events, className = "" }: CompactVerticalTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No events to display
      </div>
    );
  }

  return (
    <div className={`space-y-0 ${className}`}>
      {events.map((event, index) => (
        <div key={event.id} className="flex items-start gap-4 py-3 relative">
          {/* Left: Time */}
          <div className="w-16 flex-shrink-0 text-xs text-gray-500 font-mono">
            {event.time}
          </div>

          {/* Middle: Dot + Line */}
          <div className="relative flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
            {/* Vertical line - only show if not last item */}
            {index < events.length - 1 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-full min-h-[calc(100%-12px)] bg-gray-200" />
            )}
          </div>

          {/* Right: Event summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900">{event.type}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{event.service}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{event.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
