export const lightTheme = {
  colors: {
    background: '#fff',
    text: '#000',
    textSecondary: 'rgba(0,0,0,0.7)',
    tint: '#2f95dc',
    tabIconDefault: '#ccc',
    primary: '#9945FF',
    success: '#14F195',
    error: '#ff4444',
    border: '#eee',
    separator: '#eee',
    cardBackground: 'rgba(0,0,0,0.05)',
  },
};

export const darkTheme = {
  colors: {
    background: '#000',
    text: '#fff',
    textSecondary: 'rgba(255,255,255,0.7)',
    tint: '#fff',
    tabIconDefault: '#ccc',
    primary: '#9945FF',
    success: '#14F195',
    error: '#ff4444',
    border: 'rgba(255,255,255,0.1)',
    separator: 'rgba(255,255,255,0.1)',
    cardBackground: 'rgba(255,255,255,0.05)',
  },
};

export type AppTheme = typeof lightTheme;
