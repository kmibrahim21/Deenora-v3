
export const isValidUUID = (uuid: any): uuid is string => {
  if (!uuid || typeof uuid !== 'string') return false;
  if (uuid === 'null' || uuid === 'undefined') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};
