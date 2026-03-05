/**
 * Creates a URL path for a given page name.
 * @param {string} pageName - The name of the page (e.g., "About", "Sermons").
 * @returns {string} The URL path (e.g., "/about", "/sermons").
 */
export const createPageUrl = (pageName) => {
  const cleanedPageName = pageName?.trim().toLowerCase();
  if (!cleanedPageName || cleanedPageName === 'home') {
    return '/';
  }
  return `/${cleanedPageName}`;
};