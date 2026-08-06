import { fireEvent, render } from '@testing-library/react-native';
import type { ChatEntity } from '@kebi-app/shared';
import { ChatAnswer, toBlocks, toInlineParts } from './chat-answer';

const entity = (key: string, name: string): ChatEntity => ({
  kind: 'venue',
  key,
  name,
  uri: `kebi://venue/${key}`,
  icon: '🍕',
});

const LUIGIS = entity('c59914af', "Luigi's Hot Pizza Canggu");
const VAULT = entity('7861b346', 'Vault Nightclub Bali');

// The real monday-in-canggu answer, trimmed to the shapes that matter:
// paragraphs, a lead-in line, a bullet run, and a closing paragraph.
const ANSWER = [
  'monday is a great night to be in [canggu](kebi://area/id/bali/canggu).',
  "start at [Luigi's](kebi://venue/c59914af). monday is **literally** their night.",
  'skip for tonight:\n- [Vault](kebi://venue/7861b346) is wednesday to saturday only\n- The Mesa is a friday spot',
  "luigi's then old man's, your monday is set.",
].join('\n\n');

describe('toBlocks', () => {
  it('splits paragraphs on blank lines and groups a bullet run into one block', () => {
    expect(toBlocks(ANSWER).map((b) => b.kind)).toEqual([
      'paragraph',
      'paragraph',
      'paragraph', // "skip for tonight:"
      'bullets', // the two `- ` lines, grouped
      'paragraph',
    ]);
  });

  it('strips the bullet marker and keeps one entry per item', () => {
    const bullets = toBlocks(ANSWER).find((b) => b.kind === 'bullets');
    expect(bullets?.lines).toHaveLength(2);
    expect(bullets?.lines[0][0]).toEqual({
      kind: 'link',
      text: 'Vault',
      uri: 'kebi://venue/7861b346',
    });
  });

  it('keeps a soft-wrapped paragraph as one block', () => {
    // A single newline is kebi wrapping a sentence, not a new paragraph.
    const blocks = toBlocks('one line\nstill the same paragraph');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].lines[0]).toEqual([
      { kind: 'text', text: 'one line\nstill the same paragraph' },
    ]);
  });

  it('drops blank and whitespace-only chunks', () => {
    expect(toBlocks('\n\n  \n\nreal text\n\n   ')).toEqual([
      { kind: 'paragraph', lines: [[{ kind: 'text', text: 'real text' }]] },
    ]);
  });

  it('accepts a • bullet as well as a -', () => {
    expect(toBlocks('• first\n• second').map((b) => b.kind)).toEqual(['bullets']);
  });
});

describe('toInlineParts', () => {
  it('separates text, bold, and link parts in order', () => {
    expect(toInlineParts('go to [Luigis](kebi://venue/a) — **their** night')).toEqual([
      { kind: 'text', text: 'go to ' },
      { kind: 'link', text: 'Luigis', uri: 'kebi://venue/a' },
      { kind: 'text', text: ' — ' },
      { kind: 'bold', text: 'their' },
      { kind: 'text', text: ' night' },
    ]);
  });
});

describe('ChatAnswer', () => {
  const renderAnswer = (onOpen = jest.fn()) => ({
    onOpen,
    ...render(<ChatAnswer message={ANSWER} entities={[LUIGIS, VAULT]} onOpen={onOpen} />),
  });

  it('renders link labels and bold text, never the raw markdown', () => {
    const { getByText, queryByText } = renderAnswer();

    expect(getByText("Luigi's")).toBeTruthy(); // the answer's wording, not the canonical name
    expect(getByText('literally')).toBeTruthy();
    expect(queryByText(/kebi:\/\//)).toBeNull();
    expect(queryByText(/\*\*/)).toBeNull();
  });

  it('never underlines a link — the rail carries the affordance, not the prose', () => {
    // An answer names places constantly; underlining each one turns the
    // paragraph into a field of rules.
    const { getByText } = renderAnswer();
    const className = (node: { props: { className?: string } }) => node.props.className ?? '';

    expect(className(getByText("Luigi's"))).not.toContain('underline');
    expect(className(getByText('literally'))).not.toContain('underline');
  });

  it('opens the entity behind a tapped link', () => {
    const { getByText, onOpen } = renderAnswer();

    fireEvent.press(getByText('Vault'));

    expect(onOpen).toHaveBeenCalledWith(VAULT);
  });

  it('leaves a link with no matching entity untappable but still readable', () => {
    const onOpen = jest.fn();
    const { getByText } = render(
      <ChatAnswer
        message="head to [Somewhere](kebi://venue/unknown) tonight"
        entities={[]}
        onOpen={onOpen}
      />,
    );

    fireEvent.press(getByText('Somewhere'));

    expect(onOpen).not.toHaveBeenCalled();
    expect(getByText('Somewhere')).toBeTruthy();
  });

  it('renders a bullet marker per item', () => {
    const { getAllByText } = renderAnswer();
    expect(getAllByText('·')).toHaveLength(2);
  });
});
