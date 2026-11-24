import { fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/states/StateViews';

describe('state views', () => {
  it('LoadingState announces its message', async () => {
    await render(<LoadingState message="Finding clinics…" />);
    expect(screen.getByText('Finding clinics…')).toBeOnTheScreen();
  });

  it('EmptyState shows copy and runs its action', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        icon="paw-outline"
        title="No pets yet"
        message="Add your first pet."
        action={{ label: 'Add pet', onPress }}
      />,
    );

    expect(screen.getByRole('header', { name: 'No pets yet' })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Add pet' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('EmptyState without an action renders no button', async () => {
    await render(<EmptyState icon="paw-outline" title="Nothing here" message="Yet." />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ErrorState offers retry and shows the support reference', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState onRetry={onRetry} requestId="abc123" />);

    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.getByText('Reference: abc123')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
