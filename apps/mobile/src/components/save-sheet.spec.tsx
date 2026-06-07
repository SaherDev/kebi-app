import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SaveSheet } from './save-sheet';

// A chainable no-op so `Gesture.Pan().enabled().activeOffsetY().onUpdate().onEnd()`
// works. `mock`-prefixed names are the one kind of out-of-scope var a jest.mock
// factory may reference (babel-plugin-jest-hoist).
const mockChain = (): unknown => new Proxy({}, { get: () => () => mockChain() });

// Reanimated mock (same pattern as smart-input.spec) plus useAnimatedKeyboard,
// which the official mock doesn't ship — the sheet floats above the keyboard.
jest.mock('react-native-reanimated', () =>
  Object.assign(require('react-native-reanimated/mock'), {
    useAnimatedKeyboard: () => ({ height: { value: 0 } }),
  }),
);

// Gesture handler: render children straight through; Pan() is the chainable stub.
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: (p: { children: unknown }) => p.children,
  GestureDetector: (p: { children: unknown }) => p.children,
  Gesture: { Pan: () => mockChain() },
}));

const PLACEHOLDER = 'paste a link or type a place name...';
const noop = () => undefined;
const opacityOf = (node: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(node.props.style as never) as { opacity?: number };

describe('SaveSheet', () => {
  it('empty → CTA is dimmed (0.4) and disabled', () => {
    const onSubmit = jest.fn();
    const { getByLabelText } = render(<SaveSheet open onClose={noop} onSubmit={onSubmit} />);
    const cta = getByLabelText('save it');
    expect(opacityOf(cta)).toMatchObject({ opacity: 0.4 });
    fireEvent.press(cta);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('filled → CTA is full opacity (1) and submits the text', () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByPlaceholderText } = render(
      <SaveSheet open onClose={noop} onSubmit={onSubmit} />,
    );
    fireEvent.changeText(getByPlaceholderText(PLACEHOLDER), 'coco tam koh samui');
    const cta = getByLabelText('save it');
    expect(opacityOf(cta)).toMatchObject({ opacity: 1 });
    fireEvent.press(cta);
    expect(onSubmit).toHaveBeenCalledWith('coco tam koh samui');
  });

  it('saving → CTA shows the saving label and stays dimmed (0.4)', () => {
    const { getByLabelText } = render(
      <SaveSheet open status="saving" onClose={noop} onSubmit={noop} />,
    );
    expect(opacityOf(getByLabelText('saving'))).toMatchObject({ opacity: 0.4 });
  });

  it('shows the source meta hint for a tiktok link, not for a plain name', () => {
    const { getByText, queryByText, getByPlaceholderText } = render(
      <SaveSheet open onClose={noop} onSubmit={noop} />,
    );
    const input = getByPlaceholderText(PLACEHOLDER);
    fireEvent.changeText(input, 'coco tam');
    expect(queryByText('looks like a tiktok link')).toBeNull();
    fireEvent.changeText(input, 'https://www.tiktok.com/@x/video/1');
    expect(getByText('looks like a tiktok link')).toBeTruthy();
  });
});
