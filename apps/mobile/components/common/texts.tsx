import styled from 'styled-components/native';

// Title components - Iceberg font
export const Title1 = styled.Text`
  font-size: 32px;
  font-family: Iceberg;
  color: ${(props) => props.theme.colors.primary};
`;

export const Title2 = styled.Text`
  font-size: 24px;
  font-family: Iceberg;
  color: ${(props) => props.theme.colors.text};
`;

export const Title3 = styled.Text`
  font-size: 20px;
  font-family: Iceberg;
  color: ${(props) => props.theme.colors.text};
`;

// Body components - System font (Roboto on Android)
export const Body = styled.Text`
  font-size: 16px;
  color: ${(props) => props.theme.colors.text};
`;

export const BodySecondary = styled.Text`
  font-size: 16px;
  color: ${(props) => props.theme.colors.textSecondary};
  opacity: 0.8;
`;

export const BodySmall = styled.Text`
  font-size: 14px;
  color: ${(props) => props.theme.colors.text};
`;

export const BodySmallSecondary = styled.Text`
  font-size: 14px;
  color: ${(props) => props.theme.colors.textSecondary};
  opacity: 0.6;
`;

// Status text components
export const ErrorText = styled.Text`
  font-size: 14px;
  color: ${(props) => props.theme.colors.error};
`;

export const SuccessText = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.theme.colors.success};
`;

// Monospace text - SpaceMono for wallet addresses
export const MonoText = styled.Text`
  font-size: 14px;
  font-family: SpaceMono;
  color: ${(props) => props.theme.colors.text};
`;
