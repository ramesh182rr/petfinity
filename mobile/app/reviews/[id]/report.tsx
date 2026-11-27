import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, IconBadge, Screen, Text, TextField } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { useReportReview } from '@/features/reviews/hooks';
import type { ReportReason } from '@/features/reviews/types';
import { spacing } from '@/theme';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'fake', label: 'Not a real visit' },
  { value: 'abusive', label: 'Abusive or hateful' },
  { value: 'private_info', label: 'Shares private details' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'other', label: 'Something else' },
];

export default function ReportReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useReportReview(id);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');

  if (report.isSuccess) {
    return (
      <Screen edges={[]} testID="report-done">
        <Card style={styles.card}>
          <IconBadge name="checkmark-circle" tone="sage" size="lg" />
          <Text variant="heading">Thanks for telling us</Text>
          <Text variant="body" color="textMuted">
            We’ve hidden this review while our team takes a look. We usually decide within a day.
          </Text>
          <Button label="Done" fullWidth onPress={() => router.back()} testID="report-close" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={[]} testID="report-screen">
      <Card style={styles.card}>
        <Text variant="subheading">What’s wrong with this review?</Text>
        <View style={styles.chips}>
          {REASONS.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              selected={reason === r.value}
              onPress={() => setReason(r.value)}
              testID={`reason-${r.value}`}
            />
          ))}
        </View>
        <TextField
          label="Anything else? (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={300}
          multiline
          testID="report-note"
        />
      </Card>
      {report.isError ? (
        <Text variant="body" color="error" accessibilityRole="alert">
          {errorMessage(report.error)}
        </Text>
      ) : null}
      <Button
        label="Report review"
        icon="flag"
        size="lg"
        fullWidth
        disabled={!reason}
        loading={report.isPending}
        onPress={() => reason && report.mutate({ reason, note: note.trim() || null })}
        testID="report-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
