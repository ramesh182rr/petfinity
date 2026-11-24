import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/ui';

describe('Button', () => {
  it('renders its label as an accessible button and handles presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Book a vet" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Book a vet' });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and exposes the disabled state', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Continue' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('shows a spinner, marks itself busy and ignores presses while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} loading testID="save" />);

    expect(screen.getByTestId('save-loading')).toBeOnTheScreen();
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeBusy();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
