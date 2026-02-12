import {
  white,
  black,
  slateIndigo,
  warmCoral,
  blue,
  red,
  gray,
  lightTextSecondary,
  lightBorder,
  lightCardBackground,
  darkTextSecondary,
  darkBorder,
  darkCardBackground,
  statusCompleted,
  statusCompletedBg,
  statusForfeited,
  statusForfeitedBg,
  primaryAlpha10,
  primaryAlpha20,
  primaryAlpha40,
  iconOnPrimary,
  shadowColor,
} from './colors';

export const lightTheme = {
  colors: {
    // Base
    background: white,
    text: black,
    textSecondary: lightTextSecondary,
    tint: blue,
    tabIconDefault: gray,

    // Brand
    primary: slateIndigo,
    accent: warmCoral,
    error: red,

    // Buttons
    buttonPrimaryBg: warmCoral,
    buttonPrimaryText: white,
    buttonSecondaryBorder: slateIndigo,
    buttonSecondaryText: slateIndigo,

    // UI
    border: lightBorder,
    separator: lightBorder,
    cardBackground: lightCardBackground,

    // Status
    statusCompleted,
    statusCompletedBg,
    statusForfeited,
    statusForfeitedBg,

    // Primary alpha variants
    primaryAlpha10,
    primaryAlpha20,
    primaryAlpha40,
    iconOnPrimary,
    shadowColor,
  },
};

export const darkTheme = {
  colors: {
    // Base
    background: black,
    text: white,
    textSecondary: darkTextSecondary,
    tint: white,
    tabIconDefault: gray,

    // Brand
    primary: slateIndigo,
    accent: warmCoral,
    error: red,

    // Buttons
    buttonPrimaryBg: warmCoral,
    buttonPrimaryText: white,
    buttonSecondaryBorder: slateIndigo,
    buttonSecondaryText: slateIndigo,

    // UI
    border: darkBorder,
    separator: darkBorder,
    cardBackground: darkCardBackground,

    // Status
    statusCompleted,
    statusCompletedBg,
    statusForfeited,
    statusForfeitedBg,

    // Primary alpha variants
    primaryAlpha10,
    primaryAlpha20,
    primaryAlpha40,
    iconOnPrimary,
    shadowColor,
  },
};

export type AppTheme = typeof lightTheme;

export const cardBorderRadius = {
  borderBottomRightRadius: 30,
  borderTopLeftRadius: 4,
  borderTopRightRadius: 30,
  borderBottomLeftRadius: 4,
};

export const getStatusBgColor = (theme: AppTheme, status: string): string => {
  switch (status) {
    case 'Active':
      return theme.colors.primaryAlpha20;
    case 'Completed':
      return theme.colors.statusCompletedBg;
    case 'Forfeited':
      return theme.colors.statusForfeitedBg;
    default:
      return theme.colors.cardBackground;
  }
};

export const getStatusTextColor = (theme: AppTheme, status: string): string => {
  switch (status) {
    case 'Active':
      return theme.colors.primary;
    case 'Completed':
      return theme.colors.statusCompleted;
    case 'Forfeited':
      return theme.colors.statusForfeited;
    default:
      return theme.colors.text;
  }
};
