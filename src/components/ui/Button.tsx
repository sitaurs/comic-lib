import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** design §4 Buttons — Primary (amber) / Secondary (surface+border) / Ghost. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-bg hover:brightness-110 font-semibold',
  secondary: 'bg-elevated text-text-primary border border-hairline hover:bg-elevated/70',
  ghost: 'bg-transparent text-text-secondary hover:bg-elevated hover:text-text-primary',
  danger: 'bg-tier-d/15 text-tier-d border border-tier-d/30 hover:bg-tier-d/25',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center whitespace-nowrap transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  children: ReactNode;
}

/** Tombol ikon — selalu punya aria-label (NFR-06 aksesibilitas). */
export function IconButton({
  label,
  variant = 'ghost',
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-fast disabled:opacity-40 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
