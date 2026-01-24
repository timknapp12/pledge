import {
  white,
  black,
  burntOrange,
  deepTeal,
  blue,
  red,
  gray,
  lightTextSecondary,
  lightBorder,
  lightCardBackground,
  darkTextSecondary,
  darkBorder,
  darkCardBackground,
} from './colors';

export const lightTheme = {
  colors: {
    background: white,
    text: black,
    textSecondary: lightTextSecondary,
    tint: blue,
    tabIconDefault: gray,
    primary: burntOrange,
    success: deepTeal,
    error: red,
    border: lightBorder,
    separator: lightBorder,
    cardBackground: lightCardBackground,
  },
};

export const darkTheme = {
  colors: {
    background: black,
    text: white,
    textSecondary: darkTextSecondary,
    tint: white,
    tabIconDefault: gray,
    primary: burntOrange,
    success: deepTeal,
    error: red,
    border: darkBorder,
    separator: darkBorder,
    cardBackground: darkCardBackground,
  },
};

export type AppTheme = typeof lightTheme;
