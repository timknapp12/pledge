// Base colors
export const white = '#FFFFFF';
export const black = '#000000';

// Brand colors
export const slateIndigo = '#6366F1';
export const warmCoral = '#F97316';

// UI colors
export const blue = '#2F95DC';
export const red = '#FF4444';
export const gray = '#CCCCCC';

// Light theme specific
export const lightTextSecondary = '#000000B3'; // 70% opacity black
export const lightBorder = '#EEEEEE';
export const lightCardBackground = '#0000000D'; // 5% opacity black

// Dark theme specific
export const darkTextSecondary = '#FFFFFFB3'; // 70% opacity white
export const darkBorder = '#FFFFFF1A'; // 10% opacity white
export const darkCardBackground = '#FFFFFF1A'; // 10% opacity white

// Status colors (semantic)
export const statusCompleted = '#10B981';
export const statusCompletedBg = '#10B98120';
export const statusForfeited = '#EF4444';
export const statusForfeitedBg = '#EF444420';
export const statusExpired = '#F97316';
export const statusExpiredBg = '#F9731620';

// Primary alpha variants (for badges, borders, highlights)
export const primaryAlpha10 = '#6366F110';
export const primaryAlpha20 = '#6366F120';
export const primaryAlpha40 = '#6366F140';

// UI semantic
export const iconOnPrimary = white;
export const shadowColor = black;

// Sheet colors (for Portal-rendered components outside ThemeProvider)
// These follow iOS system colors for bottom sheets
export const sheetSlateGray = '#4A5568';
export const sheetSlateGrayAlpha10Light = 'rgba(74, 85, 104, 0.1)';
export const sheetSlateGrayAlpha10Dark = 'rgba(74, 85, 104, 0.2)';
export const sheetSlateGrayAlpha40 = 'rgba(74, 85, 104, 0.4)';

// Light sheet
export const sheetLightBackground = '#F5F5F5';
export const sheetLightCard = white;
export const sheetLightText = black;
export const sheetLightTextSecondary = '#666666';
export const sheetLightBorder = '#E0E0E0';

// Dark sheet
export const sheetDarkBackground = '#1C1C1E';
export const sheetDarkCard = '#2C2C2E';
export const sheetDarkText = white;
export const sheetDarkTextSecondary = '#8E8E93';
export const sheetDarkBorder = '#38383A';

export const SHEET_COLORS = {
  light: {
    background: sheetLightBackground,
    cardBackground: sheetLightCard,
    text: sheetLightText,
    textSecondary: sheetLightTextSecondary,
    primary: sheetSlateGray,
    primaryAlpha10: sheetSlateGrayAlpha10Light,
    primaryAlpha40: sheetSlateGrayAlpha40,
    border: sheetLightBorder,
    iconOnPrimary: white,
  },
  dark: {
    background: sheetDarkBackground,
    cardBackground: sheetDarkCard,
    text: sheetDarkText,
    textSecondary: sheetDarkTextSecondary,
    primary: sheetSlateGray,
    primaryAlpha10: sheetSlateGrayAlpha10Dark,
    primaryAlpha40: sheetSlateGrayAlpha40,
    border: sheetDarkBorder,
    iconOnPrimary: white,
  },
};
