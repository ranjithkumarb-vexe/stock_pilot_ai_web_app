import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState } from 'react';
import {
  Button,
  Chip,
  Meter,
  Modal,
  Pill,
  SegmentedControl,
  Skeleton,
  Sparkline,
  ToastProvider,
  useToast,
  meterTone,
  sparkPoints,
} from '.';

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Disclaimer">
        <button>First</button>
        <button>Last</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('traps focus, closes on Esc and restores focus to the opener', async () => {
    render(<ModalHarness />);
    const opener = screen.getByText('Open');
    await userEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Disclaimer' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('First')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByText('Last')).toHaveFocus();
    await userEvent.tab(); // wraps
    expect(screen.getByText('First')).toHaveFocus();
    await userEvent.tab({ shift: true }); // wraps backwards
    expect(screen.getByText('Last')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('has no axe violations open', async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByText('Open'));
    await screen.findByRole('dialog');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe('Toast', () => {
  function Probe() {
    const { say } = useToast();
    return <button onClick={() => say('Saved')}>go</button>;
  }
  it('announces in a polite live region and auto-dismisses after 3.2 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-region')).toHaveAttribute('aria-live', 'polite');
    await userEvent.click(screen.getByText('go'));
    expect(screen.getByTestId('toast')).toHaveTextContent('Saved');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3300);
    });
    expect(screen.queryByTestId('toast')).toBeNull();
    vi.useRealTimers();
  });
});

describe('primitives', () => {
  it('SegmentedControl is a radiogroup with arrow-key support', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Mode"
        options={['Standard', 'TL;DR', 'Deep']}
        value="Standard"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
    screen.getByRole('radio', { name: 'Standard' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('TL;DR');
  });

  it('Chip exposes aria-pressed; Button defaults to type=button; Pill carries its tone class', () => {
    render(
      <>
        <Chip pressed>Growth</Chip>
        <Button>Go</Button>
        <Pill tone="bad">Blocked</Pill>
      </>,
    );
    expect(screen.getByText('Growth')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Go')).toHaveAttribute('type', 'button');
    expect(screen.getByText('Blocked')).toHaveClass('sp-tone-bad');
  });

  it('Meter: tick at 62.5% scale, tone by share of cap', () => {
    expect(meterTone(8, 15)).toBe('accent');
    expect(meterTone(13, 15)).toBe('warn');
    expect(meterTone(17, 15)).toBe('loss');
    render(<Meter label="Position" value={15} cap={15} display="15%" />);
    const m = screen.getByRole('meter', { name: 'Position' });
    expect(m).toHaveAttribute('aria-valuenow', '15');
  });

  it('sparkPoints maps a series into the 72x22 box; Sparkline renders a polyline', () => {
    const pts = sparkPoints([1, 2, 3, 2, 4]).split(' ');
    expect(pts).toHaveLength(5);
    expect(pts[0]).toBe('0.0,20.0');
    expect(pts[4]).toBe('69.0,2.0');
    const { container } = render(<Sparkline values={[1, 2, 3]} positive />);
    expect(container.querySelector('polyline')).toHaveAttribute('stroke', 'var(--gain)');
  });

  it('Skeleton is decorative', () => {
    const { container } = render(<Skeleton width={50} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
