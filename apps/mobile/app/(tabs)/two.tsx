import { useState } from 'react';
import styled from 'styled-components/native';
import {
  Title1,
  Title2,
  Title3,
  Body,
  BodySecondary,
  BodySmall,
  BodySmallSecondary,
  ErrorText,
  SuccessText,
  MonoText,
  Separator,
  Column,
  Row,
  Card,
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  ButtonText,
  SecondaryButtonText,
  OutlineButtonText,
  FloatingLabelInput,
  TextArea,
  ThemeSelector,
  TrackedScrollView,
} from '@/components';

export default function TabTwoScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [description, setDescription] = useState('');

  return (
    <ScreenWrapper>
      <TrackedScrollView style={{ flex: 1 }}>
        <ContentContainer>
        {/* Theme Section */}
        <Section>
          <Title2>Theme</Title2>
          <Separator />
          <ThemeSelector />
        </Section>

        {/* Typography Section */}
        <Section>
          <Title2>Typography</Title2>
          <Separator />

          <Column $gap={12}>
            <Title1>Title1 - Pledge</Title1>
            <Title2>Title2 - Section Header</Title2>
            <Title3>Title3 - Card Title</Title3>
            <Body>Body - Regular text content</Body>
            <BodySecondary>BodySecondary - Descriptions</BodySecondary>
            <BodySmall>BodySmall - Fine print</BodySmall>
            <BodySmallSecondary>
              BodySmallSecondary - User ID
            </BodySmallSecondary>
            <ErrorText>ErrorText - Something went wrong</ErrorText>
            <SuccessText>SuccessText - Connected</SuccessText>
            <MonoText>MonoText - 7xKX...9f3D</MonoText>
          </Column>
        </Section>

        {/* Inputs Section */}
        <Section>
          <Title2>Inputs</Title2>
          <Separator />

          <Column $gap={20}>
            <FloatingLabelInput
              label="Name"
              value={name}
              onChangeText={setName}
            />

            <FloatingLabelInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FloatingLabelInput
              label="With Error"
              value={errorInput}
              onChangeText={setErrorInput}
              error="This field is required"
            />

            <TextArea
              label="Description"
              value={description}
              onChangeText={setDescription}
            />
          </Column>
        </Section>

        {/* Buttons Section */}
        <Section>
          <Title2>Buttons</Title2>
          <Separator />

          <Column $gap={16}>
            <PrimaryButton>
              <ButtonText>Primary Button</ButtonText>
            </PrimaryButton>

            <SecondaryButton>
              <SecondaryButtonText>Secondary Button</SecondaryButtonText>
            </SecondaryButton>

            <OutlineButton>
              <OutlineButtonText>Outline Button</OutlineButtonText>
            </OutlineButton>
          </Column>
        </Section>

        {/* Containers Section */}
        <Section>
          <Title2>Containers</Title2>
          <Separator />

          <Column $gap={16}>
            <Card>
              <Title3>Card Component</Title3>
              <BodySecondary>Cards have background and padding</BodySecondary>
            </Card>

            <Card>
              <Row $gap={12}>
                <Body>Row with gap:</Body>
                <BodySecondary>Item 1</BodySecondary>
                <BodySecondary>Item 2</BodySecondary>
              </Row>
            </Card>

            <Card>
              <Column $gap={8}>
                <Body>Column with gap:</Body>
                <BodySecondary>Stacked item 1</BodySecondary>
                <BodySecondary>Stacked item 2</BodySecondary>
              </Column>
            </Card>
          </Column>
        </Section>

        <BottomSpacer />
        </ContentContainer>
      </TrackedScrollView>
    </ScreenWrapper>
  );
}

const ScreenWrapper = styled.View`
  flex: 1;
  background-color: ${(props) => props.theme.colors.background};
`;

const ContentContainer = styled.View`
  padding: 20px;
  padding-top: 60px;
`;

const Section = styled.View`
  margin-bottom: 32px;
`;

const BottomSpacer = styled.View`
  height: 40px;
`;
