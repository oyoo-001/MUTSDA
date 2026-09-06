/**
 * Normalize API responses to always return an array
 * All backend endpoints now return: { success: true, data: [...], count: N }
 */
export const normalizeApiResponse = (response) => {
  // If response is already an array, return it (backward compatibility)
  if (Array.isArray(response)) {
    console.warn('[API] Response is raw array - backend should return { data: [...] } format');
    return response;
  }
  
  // Standard format: { success: true, data: [...] }
  if (response && response.success && Array.isArray(response.data)) {
    return response.data;
  }
  
  // Fallback for { data: [...] } without success field
  if (response && Array.isArray(response.data)) {
    return response.data;
  }
  
  // Log unexpected format and return empty array
  console.error('[API] Unexpected response format:', response);
  return [];
};

// Alias for backward compatibility
export const normalizeApiListResponse = normalizeApiResponse;
