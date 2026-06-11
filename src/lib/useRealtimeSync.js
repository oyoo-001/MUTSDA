import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/api/base44Client';

const EVENT_MAP = {
  events_updated: ['home-events', 'events'],
  sermons_updated: ['home-sermons', 'sermons', 'sermon-comments'],
  announcements_updated: ['home-announcements', 'announcements'],
  harambees_updated: ['home-harambees', 'harambees'],
  donations_updated: ['donations'],
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('live_streams_update', (activeStreams) => {
      queryClient.setQueryData(['live-streams'], activeStreams);
    });

    for (const [event, keys] of Object.entries(EVENT_MAP)) {
      socket.on(event, () => {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}
