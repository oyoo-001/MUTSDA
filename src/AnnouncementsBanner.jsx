import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Megaphone } from 'lucide-react';
import { apiClient } from '@/api/base44Client';

export function AnnouncementsBanner() {
  const {
    data: announcements,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
       const response = await apiClient.entities.Announcement.list();
       // Some SDKs wrap the array in an object (e.g., response.items). 
       // Adjust this line if your specific API returns an object.
       return response; 
    },
    initialData: [],
  });

  /**
   * SAFETY CHECK: 
   * Even with initialData, if the API returns something unexpected (like null),
   * the code below could break. We use Array.isArray and optional chaining.
   */
  const pinnedAnnouncements = Array.isArray(announcements)
    ? announcements.filter((a) => a?.pinned)
    : [];

  if (isError) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mx-4 my-4 rounded" role="alert">
        <p className="font-bold flex items-center text-sm">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Could not load announcements.
        </p>
      </div>
    );
  }

  // Handle loading state properly
  if (isLoading && pinnedAnnouncements.length === 0) {
    return null;
  }

  if (pinnedAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-600 text-blue-900 p-4 mx-4 my-4 rounded-r-lg shadow-sm" role="alert">
      <div className="space-y-4">
        {pinnedAnnouncements.map((announcement) => (
          <div key={announcement.id} className="flex items-start">
            <div className="bg-blue-600 p-1.5 rounded-full mr-3 mt-0.5">
               <Megaphone className="h-4 w-4 text-white flex-shrink-0" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{announcement.title}</p>
              {announcement.content && (
                <p className="text-xs text-blue-800/80 mt-1">{announcement.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}