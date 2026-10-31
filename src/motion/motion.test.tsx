import { render } from '@testing-library/react';
import { AiGlyph, Enter, blobPath, enter, installHoverTap, loop, prefersReducedMotion } from '.';

const reduce = (on: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    q =>
      ({
        matches: on && q.includes('prefers-reduced-motion'),
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
        onchange: null,
      }) as MediaQueryList,
  );

describe('motion engine', () => {
  it('honours prefers-reduced-motion', () => {
    reduce(true);
    expect(prefersReducedMotion()).toBe(true);
    const el = document.createElement('div');
    expect(loop(el, 'pulse')).toBeTypeOf('function'); // no-op stop, nothing started
    expect(el.style.opacity).toBe('');
  });

  it('enter() hides the element, marks data-mdone and returns a stop fn', () => {
    reduce(true);
    const el = document.createElement('div');
    const stop = enter(el, 'pop');
    expect(el.getAttribute('data-mdone')).toBe('1');
    expect(stop).toBeTypeOf('function');
    stop();
  });

  it('svg draw sets the stroke offset to its length first', () => {
    reduce(false);
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const stop = enter(el, 'draw', { len: 40, delay: 200 });
    expect(el.style.strokeDashoffset).toBe('40');
    stop();
  });

  it('blobPath builds a closed 8-segment cubic path', () => {
    const d = blobPath(0, 22, 0);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(8);
  });

  it('installHoverTap adds and removes delegated listeners', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const off = installHoverTap(document);
    expect(add.mock.calls.map(c => c[0])).toEqual(
      expect.arrayContaining(['pointerover', 'pointerout', 'pointerdown', 'pointerup']),
    );
    off();
    expect(remove.mock.calls.map(c => c[0])).toEqual(expect.arrayContaining(['pointerover', 'pointerdown']));
  });
});

describe('motion components', () => {
  it('<Enter> renders its element/children and marks it done', () => {
    reduce(true);
    const { getByTestId } = render(
      <Enter kind="rise" data-testid="x" as="section">
        hello
      </Enter>,
    );
    const el = getByTestId('x');
    expect(el.tagName).toBe('SECTION');
    expect(el).toHaveTextContent('hello');
    expect(el).toHaveAttribute('data-mdone', '1');
  });

  it('<AiGlyph> is an accessible image', () => {
    reduce(true);
    const { getByRole } = render(<AiGlyph size={24} />);
    expect(getByRole('img', { name: 'Pilot is thinking' })).toBeInTheDocument();
  });
});
