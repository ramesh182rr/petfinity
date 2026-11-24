import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button, IconBadge, Screen, Text, TextField } from '@/components/ui';
import { updateMe } from '@/features/auth/api';
import { errorMessage } from '@/features/auth/errorMessage';
import { displayNameSchema } from '@/features/auth/identifiers';
import { setUser } from '@/features/auth/session';
import { spacing } from '@/theme';

type Form = { displayName: string };

export default function OnboardingScreen() {
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: '' },
  });
  // The navigation guard moves on to the app once the user has a name.
  const save = useMutation({ mutationFn: updateMe, onSuccess: setUser });
  const onSubmit = handleSubmit(({ displayName }) => save.mutate(displayName));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen testID="onboarding-screen">
        <View style={styles.header}>
          <IconBadge name="happy-outline" tone="peach" size="lg" />
          <Text variant="title">Welcome to Petfinity!</Text>
          <Text variant="body" color="textMuted">
            What should we call you? This is how you&apos;ll appear to vets, caretakers and the
            community.
          </Text>
        </View>
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              testID="display-name-input"
              label="Your name"
              placeholder="e.g. Priya"
              autoComplete="name"
              textContentType="name"
              autoCapitalize="words"
              returnKeyType="done"
              maxLength={60}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              onSubmitEditing={() => void onSubmit()}
              error={
                formState.errors.displayName?.message ??
                (save.isError ? errorMessage(save.error) : undefined)
              }
            />
          )}
        />
        <Button
          testID="save-name"
          label="Continue"
          size="lg"
          fullWidth
          loading={save.isPending}
          onPress={() => void onSubmit()}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.md, alignItems: 'flex-start', marginTop: spacing.xl },
});
