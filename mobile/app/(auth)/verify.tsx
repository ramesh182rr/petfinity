import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { requestOtp, verifyOtp } from '@/features/auth/api';
import { errorMessage } from '@/features/auth/errorMessage';
import { completeSignIn } from '@/features/auth/session';
import type { Channel } from '@/features/auth/types';
import { spacing } from '@/theme';

type Params = { channel: Channel; destination: string; masked: string; resendAfter?: string };

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const params = useLocalSearchParams<Params>();
  const channel: Channel = params.channel === 'email' ? 'email' : 'phone';
  const destination = params.destination ?? '';
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(Number(params.resendAfter ?? 60) || 0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: (value: string) => verifyOtp(channel, destination, value),
    // The navigation guard moves the user on once the session is signed in.
    onSuccess: completeSignIn,
    onError: () => setCode(''),
  });

  const resend = useMutation({
    mutationFn: () => requestOtp(channel, destination),
    onSuccess: (result) => {
      verify.reset();
      setSecondsLeft(result.resend_after_seconds);
    },
  });

  const onChangeCode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH && !verify.isPending) {
      verify.mutate(digits);
    }
  };

  const lockedOut = isApiError(verify.error) && verify.error.code === 'too_many_attempts';
  const error = verify.isError
    ? errorMessage(verify.error)
    : resend.isError
      ? errorMessage(resend.error)
      : undefined;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen edges={[]} testID="verify-screen">
        <View style={styles.header}>
          <Text variant="title">Enter your code</Text>
          <Text variant="body" color="textMuted">
            We sent a 6-digit code to <Text variant="bodyStrong">{params.masked ?? 'you'}</Text>. It
            expires in 10 minutes.
          </Text>
        </View>

        <TextField
          testID="code-input"
          label="6-digit code"
          value={code}
          onChangeText={onChangeCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          maxLength={CODE_LENGTH}
          autoFocus
          editable={!verify.isPending && !lockedOut}
          error={error}
        />

        <Button
          testID="verify-code"
          label="Verify"
          size="lg"
          fullWidth
          loading={verify.isPending}
          disabled={code.length !== CODE_LENGTH || lockedOut}
          onPress={() => verify.mutate(code)}
        />

        <View style={styles.secondary}>
          <Button
            testID="resend-code"
            variant="tertiary"
            label={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
            disabled={secondsLeft > 0}
            loading={resend.isPending}
            onPress={() => resend.mutate()}
          />
          <Button
            variant="tertiary"
            label={channel === 'email' ? 'Use a different email' : 'Use a different number'}
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.sm },
  secondary: { alignItems: 'center', gap: spacing.xs },
});
