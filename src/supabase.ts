
/**
 * DEPRECATED: This file is kept for backward compatibility during transition.
 * Future logic should use:
 * - import { supabase } from 'lib/supabase'
 * - import { SMSService } from 'services/SMSService'
 * - import { OfflineService } from 'services/OfflineService'
 */

import { supabase } from 'lib/supabase';
import { SMSService } from 'services/SMSService';
import { OfflineService } from 'services/OfflineService';

export { supabase };
export const smsApi = SMSService;
export const offlineApi = OfflineService;
