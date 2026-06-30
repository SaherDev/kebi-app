import { render } from '@testing-library/react-native';
import { ProfileAvatar } from './profile-avatar';

describe('ProfileAvatar', () => {
  it('shows the uppercased first letter of the name', () => {
    const { getByText } = render(<ProfileAvatar name="saher" email="saher@kebi.app" />);
    expect(getByText('S')).toBeTruthy();
  });

  it('falls back to the email initial when the name is empty', () => {
    const { getByText } = render(<ProfileAvatar name="" email="alex@kebi.app" />);
    expect(getByText('A')).toBeTruthy();
  });

  it('shows a neutral dot when neither name nor email exist', () => {
    const { getByText } = render(<ProfileAvatar />);
    expect(getByText('·')).toBeTruthy();
  });
});
