// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — KYC SERVICE
// ═══════════════════════════════════════════════════════════

import { supabase } from './supabase';

export const kyc = {
  /**
   * Initiates Aadhaar verification via Edge Function
   */
  async verifyAadhaar(userId, aadhaarNumber) {
    return await supabase.functions.invoke('kyc-verify', {
      body: {
        type: 'aadhaar',
        userId,
        data: { aadhaarNumber }
      }
    });
  },

  /**
   * Initiates GST verification via Edge Function
   */
  async verifyGST(userId, gstin) {
    return await supabase.functions.invoke('kyc-verify', {
      body: {
        type: 'gst',
        userId,
        data: { gstin }
      }
    });
  },

  /**
   * Uploads identity document to secure bucket
   */
  async uploadDoc(userId, type, file) {
    const filePath = `kyc/${userId}/${type}_${Date.now()}`;
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file);

    if (error) throw error;

    // Log to kyc_records table
    await supabase.from('kyc_records').insert({
      user_id: userId,
      type: type,
      doc_url: data.path,
      status: 'submitted'
    });

    return data;
  }
};
