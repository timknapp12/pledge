import styled from 'styled-components/native';

interface GapProps {
  $gap?: number;
}

export const ScreenContainer = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: ${(props) => props.theme.colors.background};
`;

export const Column = styled.View<GapProps>`
  flex-direction: column;
  gap: ${(props) => props.$gap ?? 0}px;
`;

export const Row = styled.View<GapProps>`
  flex-direction: row;
  align-items: center;
  gap: ${(props) => props.$gap ?? 0}px;
`;

export const Separator = styled.View`
  margin: 30px 0;
  height: 2px;
  width: 80%;
  background-color: ${(props) => props.theme.colors.separator};
`;

export const Card = styled.View`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-bottom-right-radius: 30px;
  border-top-left-radius: 4px;
  border-top-right-radius: 30px;
  border-bottom-left-radius: 4px;
  padding: 16px;
`;

export const CenteredColumn = styled(Column)`
  align-items: center;
  width: 100%;
`;
