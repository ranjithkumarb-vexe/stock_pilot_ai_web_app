import { forwardRef, type ButtonHTMLAttributes } from 'react';
import './ui.css';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link' | 'ghost';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
};

/** Design-system buttons: Primary (accent gradient), Secondary, Destructive, Text link. Hover/tap springs come from <MotionRoot>. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  const cls = [
    'sp-btn',
    `sp-btn--${variant}`,
    size !== 'md' && `sp-btn--${size}`,
    block && 'sp-btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button ref={ref} type={type} className={cls} {...rest} />;
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }
>(function IconButton({ className, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={['sp-iconbtn', className].filter(Boolean).join(' ')} {...rest} />
  );
});
