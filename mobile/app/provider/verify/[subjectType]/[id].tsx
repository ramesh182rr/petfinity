import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  HeroScreen,
  IconBadge,
  ListRow,
  SectionHeader,
  StatusPill,
  Text,
  TextField,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { DocumentPickError, pickDocument } from '@/features/providers/documentPicking';
import {
  useClinic,
  useDeleteDocument,
  useProviderProfile,
  useSubmitForReview,
  useUploadDocument,
  useVerification,
} from '@/features/providers/hooks';
import {
  DOC_INFO,
  FIELD_LABELS,
  OPTIONAL_DOCS,
  PROVIDER_LABEL,
  STATUS_INFO,
} from '@/features/providers/labels';
import type { DocumentType, SubjectType } from '@/features/providers/types';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, radius, spacing } from '@/theme';

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return '';
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export default function VerificationScreen() {
  const params = useLocalSearchParams<{ subjectType: string; id: string }>();
  const subjectType: SubjectType = params.subjectType === 'clinic' ? 'clinic' : 'provider_profile';
  const id = params.id;
  const isClinic = subjectType === 'clinic';
  // Only the relevant subject is fetched; the other query stays disabled.
  const profile = useProviderProfile(id, !isClinic);
  const clinic = useClinic(id, isClinic);
  const overview = useVerification(subjectType, id);
  useRefreshOnFocus(overview.refetch);
  const upload = useUploadDocument(subjectType, id);
  const remove = useDeleteDocument(subjectType, id);
  const submit = useSubmitForReview(subjectType, id);
  const [note, setNote] = useState('');
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);

  const subject = isClinic ? clinic : profile;
  if (overview.isPending || subject.isPending)
    return <LoadingState message="Loading verification…" />;
  if (overview.isError || subject.isError || !overview.data) {
    const err = overview.error ?? subject.error;
    return (
      <ErrorState
        onRetry={() => void overview.refetch()}
        requestId={isApiError(err) ? err.requestId : null}
      />
    );
  }
  const v = overview.data;
  const status = STATUS_INFO[v.verification_status];
  const name = isClinic ? clinic.data?.name : profile.data?.display_name;
  const kind = isClinic ? 'clinic' : (profile.data?.provider_type ?? 'veterinarian');
  const kindLabel = isClinic
    ? 'Clinic'
    : PROVIDER_LABEL[profile.data?.provider_type ?? 'veterinarian'];
  const editPath: Href = isClinic ? `/provider/clinic/${id}` : `/provider/profile/${id}`;
  const latest = v.latest_submission;
  const ready = v.missing_documents.length === 0 && v.missing_fields.length === 0;
  const canSubmit = v.can_edit_documents && ready && v.verification_status !== 'verified';

  const addDocument = async (docType: DocumentType) => {
    try {
      const file = await pickDocument();
      if (!file) return;
      setUploadingType(docType);
      upload.mutate(
        { docType, file },
        {
          onSettled: () => setUploadingType(null),
          onError: (e) =>
            Alert.alert(
              'Upload failed',
              isApiError(e)
                ? e.message
                : "The file didn't upload. Check your connection and try again.",
            ),
        },
      );
    } catch (e) {
      Alert.alert(
        'Can’t use that file',
        e instanceof DocumentPickError ? e.message : 'Please try another file.',
      );
    }
  };

  const confirmRemove = (documentId: string, label: string) =>
    Alert.alert(`Remove ${label}?`, 'You can upload a new one afterwards.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(documentId) },
    ]);

  const present = new Set(v.documents.map((d) => d.doc_type));

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="verification-screen"
        underHeader
        eyebrow={`${kindLabel} verification`}
        title={name ?? kindLabel}
        subtitle={status.message}
        overlap
        heroContent={<StatusPill label={status.label} tone="onDark" testID="verification-status" />}
      >
        {latest?.decision_reason &&
        (v.verification_status === 'needs_info' || v.verification_status === 'rejected') ? (
          <Card
            style={[
              styles.notice,
              v.verification_status === 'rejected' ? styles.noticeError : styles.noticeWarning,
            ]}
          >
            <View style={styles.noticeHeader}>
              <Ionicons
                name="chatbubble-ellipses"
                size={18}
                color={v.verification_status === 'rejected' ? colors.error : colors.warning}
              />
              <Text variant="label">Message from the Petfinity team</Text>
            </View>
            <Text variant="body" testID="review-message">
              {latest.decision_reason}
            </Text>
          </Card>
        ) : null}

        {v.verification_status === 'verified' ? (
          <Card style={[styles.notice, styles.noticeSuccess]}>
            <View style={styles.noticeHeader}>
              <Ionicons name="shield-checkmark" size={18} color={colors.success} />
              <Text variant="label">Verified by Petfinity</Text>
            </View>
            <Text variant="body">
              Pet parents will see a verified badge once discovery opens. Changing your registration
              details later will need a re-check.
            </Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <SectionHeader
            title="Profile details"
            actionLabel="Edit"
            onAction={() => router.push(editPath)}
          />
          {v.missing_fields.length ? (
            <ListRow
              icon="create"
              tone="coral"
              title="Add your registration details"
              subtitle={`Missing: ${v.missing_fields.map((f) => FIELD_LABELS[f] ?? f).join(', ')}`}
              onPress={() => router.push(editPath)}
              testID="missing-fields"
            />
          ) : (
            <ListRow
              icon="checkmark-circle"
              tone="sage"
              title="Details complete"
              subtitle="You can still edit them anytime."
            />
          )}
        </Card>

        <Card style={styles.card}>
          <SectionHeader title="Required documents" />
          <Text variant="caption" color="textMuted">
            PDF or photo, up to 10 MB. Private: only our verification team can see them.
          </Text>
          {v.required_documents.map((docType) => {
            const done = present.has(docType);
            return (
              <View key={docType} style={styles.docRow} testID={`required-${docType}`}>
                <View style={[styles.check, done && styles.checkDone]}>
                  <Ionicons
                    name={done ? 'checkmark' : 'ellipse-outline'}
                    size={16}
                    color={done ? colors.textOnPrimary : colors.textMuted}
                  />
                </View>
                <View style={styles.docText}>
                  <Text variant="bodyStrong">{DOC_INFO[docType].label}</Text>
                  <Text variant="caption" color="textMuted">
                    {DOC_INFO[docType].hint}
                  </Text>
                </View>
                {!done && v.can_edit_documents ? (
                  <Button
                    testID={`upload-${docType}`}
                    label="Upload"
                    icon="cloud-upload-outline"
                    variant="secondary"
                    loading={uploadingType === docType}
                    onPress={() => void addDocument(docType)}
                  />
                ) : null}
              </View>
            );
          })}
          {v.can_edit_documents ? (
            <View style={styles.optional}>
              <Text variant="label" color="textMuted">
                Optional
              </Text>
              <View style={styles.optionalRow}>
                {OPTIONAL_DOCS[kind].map((docType) => (
                  <Button
                    key={docType}
                    label={DOC_INFO[docType].label}
                    icon="add"
                    variant="tertiary"
                    loading={uploadingType === docType}
                    onPress={() => void addDocument(docType)}
                    style={styles.optionalButton}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        {v.documents.length ? (
          <Card style={styles.card}>
            <SectionHeader title="Uploaded" />
            {v.documents.map((d) => (
              <ListRow
                key={d.id}
                icon={d.content_type === 'application/pdf' ? 'document-text' : 'image'}
                tone={d.submitted ? 'sage' : 'lavender'}
                title={DOC_INFO[d.doc_type].label}
                subtitle={`${d.content_type === 'application/pdf' ? 'PDF' : 'Image'} · ${formatSize(d.size_bytes)}`}
                trailing={
                  d.submitted ? (
                    <StatusPill label="Sent" tone="success" />
                  ) : v.can_edit_documents ? (
                    <Button
                      label="Remove"
                      variant="tertiary"
                      onPress={() => confirmRemove(d.id, DOC_INFO[d.doc_type].label)}
                    />
                  ) : null
                }
              />
            ))}
          </Card>
        ) : null}

        {v.verification_status === 'submitted' ? (
          <Card style={[styles.notice, styles.noticeWarning]}>
            <View style={styles.noticeHeader}>
              <IconBadge name="hourglass" tone="peach" />
              <Text variant="bodyStrong">Waiting for review</Text>
            </View>
            <Text variant="body" color="textMuted">
              Documents are locked while we review them.
            </Text>
          </Card>
        ) : canSubmit || v.can_edit_documents ? (
          <Card style={styles.card}>
            <SectionHeader title="Submit for review" />
            <TextField
              label="Note for our team (optional)"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
              placeholder="Anything that helps us verify you"
              testID="submit-note"
            />
            {!ready ? (
              <Text variant="caption" color="textMuted">
                Complete the details and required documents above to submit.
              </Text>
            ) : null}
            {submit.isError ? (
              <Text variant="body" color="error" accessibilityRole="alert">
                {errorMessage(submit.error)}
              </Text>
            ) : null}
            <Button
              testID="submit-review"
              label="Submit for review"
              icon="send"
              size="lg"
              fullWidth
              disabled={!canSubmit}
              loading={submit.isPending}
              onPress={() => submit.mutate(note.trim() || null, { onSuccess: () => setNote('') })}
            />
          </Card>
        ) : null}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  notice: { gap: spacing.sm, borderWidth: 1 },
  noticeWarning: { backgroundColor: colors.warningTint, borderColor: colors.warningTint },
  noticeError: { backgroundColor: colors.errorTint, borderColor: colors.errorTint },
  noticeSuccess: { backgroundColor: colors.successTint, borderColor: colors.successTint },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  check: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  docText: { flex: 1, gap: spacing.xxs },
  optional: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  optionalRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xl },
  // Align optional links with the content edge above (no button side padding).
  optionalButton: { paddingHorizontal: 0 },
});
