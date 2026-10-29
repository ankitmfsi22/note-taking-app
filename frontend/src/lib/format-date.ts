// UTC keeps the shown day equal to the stored one, whatever the viewer's zone.
const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

export const formatDate = (iso: string): string => formatter.format(new Date(iso));
