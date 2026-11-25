import { router } from 'expo-router';

import { backToWorkspace } from '@/features/catalog/navigation';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const mocked = router as unknown as Record<'canGoBack' | 'back' | 'replace', jest.Mock>;

beforeEach(() => jest.clearAllMocks());

describe('backToWorkspace', () => {
  it('goes back when there is history', () => {
    mocked.canGoBack.mockReturnValue(true);
    backToWorkspace('clinic', 'c-1');
    expect(mocked.back).toHaveBeenCalled();
    expect(mocked.replace).not.toHaveBeenCalled();
  });

  it('opens the workspace when the editor was opened directly', () => {
    mocked.canGoBack.mockReturnValue(false);
    backToWorkspace('provider_profile', 'pp-1');
    expect(mocked.replace).toHaveBeenCalledWith('/provider/manage/provider_profile/pp-1');
  });
});
