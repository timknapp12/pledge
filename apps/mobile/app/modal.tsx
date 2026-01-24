import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import styled from 'styled-components/native';

export default function ModalScreen() {
  return (
    <Container>
      <Title>Modal</Title>
      <Separator />
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.theme.colors.background};
`;

const Title = styled.Text`
  font-size: 20px;
  font-weight: bold;
  color: ${(props) => props.theme.colors.text};
`;

const Separator = styled.View`
  margin: 30px 0;
  height: 1px;
  width: 80%;
  background-color: ${(props) => props.theme.colors.separator};
`;
