import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button, IconBadge, Screen, SegmentedControl, Text, TextField } from '@/components/ui';
import { requestOtp } from '@/features/auth/api';
import { errorMessage } from '@/features/auth/errorMessage';
import { schemaFor, toApiDestination, type DestinationForm } from '@/features/auth/identifiers';
import type { Channel } from '@/features/auth/types';
import { spacing } from '@/theme';

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'phone', label: 'Mobile number' },
  { value: 'email', label: 'Email' },
];

export default function SignInScreen() {
  const [channel, setChannel] = useState<Channel>('phone');
  const { control, handleSubmit, reset, formState } = useForm<DestinationForm>({
    resolver: zodResolver(schemaFor(channel)),
    defaultValues: { destination: '' },
  });

  const sendCode = useMutation({
    mutationFn: (destination: string) => requestOtp(channel, destination),
  });

  const onSubmit = handleSubmit(({ destination }) => {
    const apiDestination = toApiDestination(channel, destination);
    sendCode.mutate(apiDestination, {
      onSuccess: (result) =>
        router.push({
          pathname: '/verify',
          params: {
            channel,
            destination: apiDestination,
            masked: result.destination_masked,
            resendAfter: String(result.resend_after_seconds),
          },
        }),
    });
  });

  const switchChannel = (next: Channel) => {
    setChannel(next);
    reset({ destination: '' });
    sendCode.reset();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen testID="sign-in-screen">
        <View style={styles.brand}>
          <IconBadge name="paw" tone="lavender" size="lg" />
          <Text variant="display" align="center">
            Petfinity
          </Text>
          <Text variant="body" color="textMuted" align="center">
            Every paw. Every need. Every connection.
          </Text>
        </View>

        <View style={styles.form}>
          <Text variant="heading">Sign in or create an account</Text>
          <Text variant="body" color="textMuted">
            We&apos;ll send you a 6-digit code. No password needed.
          </Text>

          <SegmentedControl
            accessibilityLabel="Sign in with"
            options={CHANNELS}
            value={channel}
            onChange={switchChannel}
          />

          <Controller
            control={control}
            name="destination"
            render={({ field: { onChange, onBlur, value } }) =>
              channel === 'phone' ? (
                <TextField
                  key="phone"
                  testID="destination-input"
                  label="Mobile number"
                  prefix={<Text variant="bodyStrong">+91</Text>}
                  placeholder="98765 43210"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  returnKeyType="send"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={() => void onSubmit()}
                  error={formState.errors.destination?.message}
                />
              ) : (
                <TextField
                  key="email"
                  testID="destination-input"
                  label="Email address"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={() => void onSubmit()}
                  error={formState.errors.destination?.message}
                />
              )
            }
          />

          {sendCode.isError ? (
            <Text variant="body" color="error" accessibilityRole="alert" testID="sign-in-error">
              {errorMessage(sendCode.error)}
            </Text>
          ) : null}

          <Button
            testID="send-code"
            label="Send code"
            size="lg"
            fullWidth
            loading={sendCode.isPending}
            onPress={() => void onSubmit()}
          />
        </View>

        <Text variant="caption" color="textMuted" align="center">
          By continuing you agree to Petfinity&apos;s Terms of Service and Privacy Policy.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brand: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  form: { gap: spacing.lg },
});
