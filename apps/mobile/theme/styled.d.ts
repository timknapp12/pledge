import 'styled-components/native';
import { AppTheme } from './index';

declare module 'styled-components/native' {
  export interface DefaultTheme extends AppTheme {}
}
