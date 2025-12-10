import * as React from 'react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';

/**
 * Heading - переиспользуемый компонент для заголовков
 */
export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level, as, className, children, ...props }, ref) => {
    const Component = as || (`h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5');
    const headingKey = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
    
    return (
      <Component
        ref={ref}
        className={cn(typography.heading[headingKey], className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Heading.displayName = 'Heading';

/**
 * Text - переиспользуемый компонент для текста
 */
export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  size?: 'base' | 'small' | 'micro';
  muted?: boolean;
  mono?: boolean;
  as?: 'p' | 'span' | 'div';
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ size = 'base', muted = false, mono = false, as = 'p', className, children, ...props }, ref) => {
    const Component = as;
    
    let classes: string;
    if (mono) {
      classes = typography.mono[size];
    } else if (muted) {
      classes = typography.muted[size];
    } else {
      classes = typography.body[size];
    }
    
    return (
      <Component
        ref={ref as any}
        className={cn(classes, className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Text.displayName = 'Text';

/**
 * StatusText - компонент для текста со статусом (success, warning, error, info)
 */
export interface StatusTextProps extends React.HTMLAttributes<HTMLElement> {
  status: 'success' | 'warning' | 'error' | 'info';
  size?: 'base' | 'small' | 'micro';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  as?: 'p' | 'span' | 'div';
}

export const StatusText = React.forwardRef<HTMLElement, StatusTextProps>(
  ({ status, size = 'base', weight = 'normal', as = 'span', className, children, ...props }, ref) => {
    const Component = as;
    
    const sizeClasses = {
      base: 'text-sm',
      small: 'text-xs',
      micro: 'text-[10px]',
    };
    
    const weightClasses = {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    };
    
    return (
      <Component
        ref={ref as any}
        className={cn(
          sizeClasses[size],
          weightClasses[weight],
          typography.status[status],
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
StatusText.displayName = 'StatusText';

/**
 * PageTitle - заголовок страницы (H1)
 */
export interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2';
}

export const PageTitle = React.forwardRef<HTMLHeadingElement, PageTitleProps>(
  ({ as = 'h2', className, children, ...props }, ref) => {
    return (
      <Heading
        ref={ref}
        level={1}
        as={as}
        className={className}
        {...props}
      >
        {children}
      </Heading>
    );
  }
);
PageTitle.displayName = 'PageTitle';

/**
 * SectionTitle - заголовок секции (H2)
 */
export interface SectionTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3';
}

export const SectionTitle = React.forwardRef<HTMLHeadingElement, SectionTitleProps>(
  ({ as = 'h3', className, children, ...props }, ref) => {
    return (
      <Heading
        ref={ref}
        level={2}
        as={as}
        className={className}
        {...props}
      >
        {children}
      </Heading>
    );
  }
);
SectionTitle.displayName = 'SectionTitle';

/**
 * PanelTitle - заголовок панели (H3)
 */
export interface PanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h3' | 'h4';
}

export const PanelTitle = React.forwardRef<HTMLHeadingElement, PanelTitleProps>(
  ({ as = 'h3', className, children, ...props }, ref) => {
    return (
      <Heading
        ref={ref}
        level={3}
        as={as}
        className={className}
        {...props}
      >
        {children}
      </Heading>
    );
  }
);
PanelTitle.displayName = 'PanelTitle';

/**
 * Description - описание под заголовком
 */
export interface DescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'div';
}

export const Description = React.forwardRef<HTMLParagraphElement, DescriptionProps>(
  ({ as = 'p', className, children, ...props }, ref) => {
    return (
      <Text
        ref={ref as any}
        size="base"
        muted
        as={as}
        className={cn('mt-1', className)}
        {...props}
      >
        {children}
      </Text>
    );
  }
);
Description.displayName = 'Description';




