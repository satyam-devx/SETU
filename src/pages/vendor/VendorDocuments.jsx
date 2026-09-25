import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Building2,
  CreditCard,
  Receipt,
  Loader2,
  Camera,
  RefreshCw,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';

import { upsertKycRecord } from '@/lib/api';

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { subscribeRealtimeChannel } from '@/lib/realtime-manager';
import { useAuth } from '@/lib/AuthContext';
import { useKycRecords } from '@/hooks/queries/useVendor';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { validateDocumentSignature } from '@/lib/upload-security';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const DOCUMENT_DEFINITIONS = [
  {
    id: 'aadhaar',
    type: 'aadhaar',
    name: 'Aadhaar Card',
    icon: FileText,
    required: true,
    accept: '.jpg,.jpeg,.png,.webp,.pdf',
  },
  {
    id: 'pan',
    type: 'pan',
    name: 'PAN Card',
    icon: FileText,
    required: true,
    accept: '.jpg,.jpeg,.png,.webp,.pdf',
  },
  {
    id: 'gstin',
    type: 'gstin',
    name: 'GST Certificate',
    icon: Building2,
    required: false,
    accept: '.jpg,.jpeg,.png,.webp,.pdf',
  },
  {
    id: 'shop_photo',
    type: 'shop_photo',
    name: 'Shop Photo (Front)',
    icon: Camera,
    required: true,
    accept: '.jpg,.jpeg,.png,.webp',
  },
  {
    id: 'selfie',
    type: 'selfie',
    name: 'Identity Selfie',
    icon: FileText,
    required: true,
    accept: '.jpg,.jpeg,.png,.webp',
  },
];

const statusConfig = {
  verified: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-100',
    label: 'Verified',
  },

  submitted: {
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    label: 'Under Review',
  },

  pending: {
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    label: 'Pending',
  },

  rejected: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-100',
    label: 'Rejected',
  },

  missing: {
    icon: Upload,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    label: 'Not Uploaded',
  },
};

function formatDate(value) {
  if (!value) return null;

  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function maskDocumentNumber(type, value) {
  if (!value) return '—';

  const clean = String(value).trim();

  if (type === 'aadhaar') {
    const digits = clean.replace(/\D/g, '');

    if (digits.length >= 4) {
      return `XXXX-XXXX-${digits.slice(-4)}`;
    }

    return '••••';
  }

  if (type === 'pan') {
    if (clean.length >= 4) {
      return `${clean.slice(0, 2)}••••${clean.slice(-2)}`;
    }

    return '••••';
  }

  if (type === 'gstin') {
    if (clean.length >= 6) {
      return `${clean.slice(0, 2)}••••••${clean.slice(-4)}`;
    }

    return '••••';
  }

  return clean;
}

function getRecordForType(records, type) {
  return records.find((record) => record.type === type) || null;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function VendorDocuments() {
  const { user } = useAuth();
  const {
    data: records = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useKycRecords(user?.id);
  const [uploadingType, setUploadingType] = useState(null);
  const [error, setError] = useState('');

  const inputRefs = useRef({});

  useEffect(() => {
    if (queryError) setError(queryError.message || 'Unable to load your business documents. Please try again.');
  }, [queryError]);

  /* ---------------------------------------------------------------------- */
  /* Real-time KYC updates                                                   */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return undefined;

    return subscribeRealtimeChannel({
      key: `kyc:${user.id}`,
      build: (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'kyc_records', filter: `user_id=eq.${user.id}`,
      }, emit),
      onEvent: () => refetch(),
      onRecover: () => refetch(),
    });
  }, [user?.id, refetch]);

  /* ---------------------------------------------------------------------- */
  /* Merge database records with the real document definitions               */
  /* ---------------------------------------------------------------------- */

  const documents = useMemo(() => {
    return DOCUMENT_DEFINITIONS.map((definition) => {
      const record = getRecordForType(records, definition.type);

      return {
        ...definition,
        record,
        status: record?.status || 'missing',
        number: maskDocumentNumber(
          definition.type,
          record?.document_number ||
            record?.document_no ||
            record?.number ||
            record?.meta?.document_number ||
            record?.meta?.document_no
        ),
        uploaded: formatDate(
          record?.submitted_at ||
            record?.uploaded_at ||
            record?.created_at
        ),
        updated: formatDate(record?.updated_at),
        docUrl: record?.doc_url || null,
        rejectionReason:
          record?.rejection_reason ||
          record?.meta?.rejection_reason ||
          null,
      };
    });
  }, [records]);

  const verifiedCount = documents.filter(
    (document) => document.status === 'verified'
  ).length;

  const uploadedCount = documents.filter(
    (document) =>
      document.status === 'verified' ||
      document.status === 'submitted' ||
      document.status === 'pending'
  ).length;

  const requiredDocuments = documents.filter(
    (document) => document.required
  );

  const requiredVerifiedCount = requiredDocuments.filter(
    (document) => document.status === 'verified'
  ).length;

  const verificationPercentage =
    documents.length > 0
      ? Math.round((verifiedCount / documents.length) * 100)
      : 0;

  /* ---------------------------------------------------------------------- */
  /* Upload                                                                  */
  /* ---------------------------------------------------------------------- */

  const handleUploadClick = (type) => {
    inputRefs.current[type]?.click();
  };

  const handleFileChange = async (event, document) => {
    const file = event.target.files?.[0];

    /*
     * Reset input so the same file can be selected again after
     * a failed upload or replacement.
     */
    event.target.value = '';

    if (!file) return;

    setError('');

    const allowedTypes = document.type === 'shop_photo' || document.type === 'selfie'
      ? new Set(['image/jpeg', 'image/png', 'image/webp'])
      : new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    const validation = await validateDocumentSignature(file, { maxBytes: 10 * 1024 * 1024, allowedTypes });
    if (!validation.ok) { setError(`${document.name}: ${validation.error}`); return; }

    setUploadingType(document.type);

    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          'Document uploads require a configured SETU backend.'
        );
      }

      if (!user?.id) {
        throw new Error('Please sign in again before uploading documents.');
      }

      /*
       * We intentionally use a user-scoped storage path.
       *
       * Example:
       * kyc-documents/<user-id>/aadhaar-<timestamp>.pdf
       *
       * This matches the existing kyc-documents storage bucket
       * and keeps documents separated by authenticated user.
       */
      const extension =
        file.name.split('.').pop()?.toLowerCase() || 'bin';

      const safeExtension = extension.replace(/[^a-z0-9]/g, '');

      const path = [
        user.id,
        `${document.type}-${Date.now()}.${safeExtension}`,
      ].join('/');

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      /*
       * kyc-documents is intentionally not treated as a public bucket.
       * Therefore we store the storage path in doc_url rather than
       * exposing a permanent public URL.
       */
      const existingRecord = getRecordForType(
        records,
        document.type
      );

      const recordPayload = {
        user_id: user.id,
        type: document.type,
        status: 'submitted',
        doc_url: path,
      };

      /*
       * Preserve any existing metadata if available.
       */
      if (existingRecord?.meta) {
        recordPayload.meta = {
          ...existingRecord.meta,
          original_filename: file.name,
          mime_type: file.type,
          size: file.size,
        };
      } else {
        recordPayload.meta = {
          original_filename: file.name,
          mime_type: file.type,
          size: file.size,
        };
      }

      /*
       * If a record already exists, keep its ID so that we update
       * the same KYC record instead of creating duplicates.
       */
      if (existingRecord?.id) {
        recordPayload.id = existingRecord.id;
      }

      const result = await upsertKycRecord(recordPayload);

      if (result.error) {
        /*
         * The file was uploaded but the DB write failed.
         * Try to clean the orphaned file.
         */
        await supabase.storage
          .from('kyc-documents')
          .remove([path])
          .catch(() => {});

        throw new Error(result.error.message);
      }

      await queryClientInstance.invalidateQueries(queryKeys.kyc.byUser(user.id));
      await refetch();
    } catch (err) {
      console.error('[VendorDocuments] upload:', err);

      setError(
        err?.message ||
          `Unable to upload ${document.name}. Please try again.`
      );
    } finally {
      setUploadingType(null);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Document preview                                                       */
  /* ---------------------------------------------------------------------- */

  const handleViewDocument = async (document) => {
    if (!document.docUrl || !isSupabaseConfigured) return;

    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(document.docUrl, 60);

      if (signedUrlError) {
        throw signedUrlError;
      }

      if (data?.signedUrl) {
        window.open(
          data.signedUrl,
          '_blank',
          'noopener,noreferrer'
        );
      }
    } catch (err) {
      console.error('[VendorDocuments] preview:', err);

      setError(
        'Unable to open this document. Please try again.'
      );
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="pb-20">
      <AppHeader
        title="Business Documents"
        subtitle="KYC & compliance records"
      />

      <div className="p-4 space-y-4">

        {/* ---------------------------------------------------------------- */}
        {/* Real verification summary                                       */}
        {/* ---------------------------------------------------------------- */}

        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Verification Status
              </p>

              {loading ? (
                <div className="flex items-center gap-2 mt-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    Checking documents...
                  </p>
                </div>
              ) : (
                <p className="text-lg font-bold">
                  {verifiedCount} / {documents.length} verified
                </p>
              )}

              {!loading && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {requiredVerifiedCount} / {requiredDocuments.length}{' '}
                  required documents verified
                </p>
              )}
            </div>

            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{
                width: `${verificationPercentage}%`,
              }}
            />
          </div>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Error                                                             */}
        {/* ---------------------------------------------------------------- */}

        {error && (
          <Card className="p-3 border-red-200 bg-red-50">
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-red-800">
                  {error}
                </p>

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs"
                  onClick={refetch}
                  disabled={loading}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Try Again
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Real documents                                                   */}
        {/* ---------------------------------------------------------------- */}

        <div className="space-y-2">
          {documents.map((doc) => {
            const cfg =
              statusConfig[doc.status] ||
              statusConfig.missing;

            const StatusIcon = cfg.icon;

            const isUploading =
              uploadingType === doc.type;

            const needsUpload =
              doc.status === 'missing' ||
              doc.status === 'rejected' ||
              doc.status === 'pending';

            const isSubmitted =
              doc.status === 'submitted';

            return (
              <Card
                key={doc.id}
                className="p-4 border-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <doc.icon className="w-5 h-5 text-muted-foreground" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm">
                          {doc.name}
                        </p>

                        {doc.required && (
                          <span className="text-[9px] text-red-500">
                            Required
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {doc.number}
                      </p>

                      {doc.uploaded && (
                        <p className="text-[10px] text-muted-foreground">
                          Uploaded: {doc.uploaded}
                        </p>
                      )}

                      {doc.updated &&
                        doc.updated !== doc.uploaded && (
                          <p className="text-[10px] text-muted-foreground">
                            Updated: {doc.updated}
                          </p>
                        )}

                      {doc.rejectionReason && (
                        <p className="text-[10px] text-red-500 mt-1">
                          Reason: {doc.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>

                  <Badge
                    className={`text-[9px] ${cfg.bg} ${cfg.color} border-0 shrink-0`}
                  >
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {cfg.label}
                  </Badge>
                </div>

                {/* -------------------------------------------------------- */}
                {/* Existing uploaded document                               */}
                {/* -------------------------------------------------------- */}

                {doc.docUrl && doc.status !== 'rejected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 h-8 text-xs"
                    onClick={() => handleViewDocument(doc)}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    View Document
                  </Button>
                )}

                {/* -------------------------------------------------------- */}
                {/* Missing / rejected / pending                             */}
                {/* -------------------------------------------------------- */}

                {needsUpload && (
                  <>
                    <input
                      ref={(element) => {
                        inputRefs.current[doc.type] = element;
                      }}
                      type="file"
                      accept={doc.accept}
                      className="hidden"
                      onChange={(event) =>
                        handleFileChange(event, doc)
                      }
                    />

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 h-8 text-xs"
                      onClick={() =>
                        handleUploadClick(doc.type)
                      }
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 mr-1" />
                          {doc.status === 'rejected'
                            ? 'Re-upload Document'
                            : 'Upload Document'}
                        </>
                      )}
                    </Button>
                  </>
                )}

                {/* -------------------------------------------------------- */}
                {/* Submitted: allow replacement without calling it verified */}
                {/* -------------------------------------------------------- */}

                {isSubmitted && (
                  <>
                    <input
                      ref={(element) => {
                        inputRefs.current[doc.type] = element;
                      }}
                      type="file"
                      accept={doc.accept}
                      className="hidden"
                      onChange={(event) =>
                        handleFileChange(event, doc)
                      }
                    />

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 h-8 text-xs"
                      onClick={() =>
                        handleUploadClick(doc.type)
                      }
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Replace Document
                        </>
                      )}
                    </Button>
                  </>
                )}
              </Card>
            );
          })}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Shop photo visibility                                            */}
        {/* ---------------------------------------------------------------- */}

        {(() => {
          const shopPhoto = documents.find(
            (document) => document.type === 'shop_photo'
          );

          if (!shopPhoto?.docUrl) return null;

          return (
            <Card className="p-4 border-border bg-green-50 border-green-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-green-600" />
                </div>

                <div>
                  <p className="text-xs font-semibold text-green-800">
                    Shop photo uploaded
                  </p>

                  <p className="text-[10px] text-green-700 mt-1">
                    Your shop photo is stored in SETU and can be used
                    for your public vendor/store profile after it passes
                    the required verification/moderation checks.
                  </p>
                </div>
              </div>
            </Card>
          );
        })()}

        {/* ---------------------------------------------------------------- */}
        {/* Help                                                              */}
        {/* ---------------------------------------------------------------- */}

        <Card className="p-4 border-border bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>Need help?</strong> Contact your block anchor or
            SETU support to assist with document verification.
            Documents marked as rejected can be uploaded again.
          </p>
        </Card>
      </div>
    </div>
  );
}
