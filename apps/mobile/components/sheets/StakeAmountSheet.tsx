import { forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Keyboard } from 'react-native';
import BottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { BaseSheet } from './BaseSheet';
import { RoundButton, Row } from '../common';

const PRESETS = [5, 10, 25, 50, 100];

interface StakeAmountSheetProps {
  value: string;
  walletBalance: number | null;
  balanceLoading?: boolean;
  onConfirm: (amount: string) => void;
  onClose?: () => void;
}

export const StakeAmountSheet = forwardRef<BottomSheet, StakeAmountSheetProps>(
  ({ value, walletBalance, balanceLoading, onConfirm, onClose }, ref) => {
    const { t } = useTranslation();
    const { isDark } = useThemeMode();
    const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

    const [amount, setAmount] = useState(value);
    const [hasBeenOpened, setHasBeenOpened] = useState(false);
    const isOpen = useRef(false);

    useEffect(() => {
      setAmount(value);
    }, [value]);

    // Snap sheet back to original position when keyboard dismisses,
    // but only if this sheet is actually open.
    useEffect(() => {
      const sub = Keyboard.addListener('keyboardDidHide', () => {
        if (isOpen.current && ref && 'current' in ref && ref.current) {
          ref.current.snapToIndex(0);
        }
      });
      return () => sub.remove();
    }, [ref]);

    const selectedPreset = PRESETS.find((p) => parseFloat(amount) === p);

    const handlePresetSelect = useCallback((preset: number) => {
      setAmount(String(preset));
    }, []);

    const handleMax = useCallback(() => {
      if (walletBalance != null && walletBalance > 0) {
        const maxAmount = Math.floor(walletBalance * 100) / 100;
        setAmount(String(maxAmount));
      }
    }, [walletBalance]);

    const closeSheet = useCallback(() => {
      isOpen.current = false;
      Keyboard.dismiss();
      if (ref && 'current' in ref && ref.current) {
        ref.current.close();
      }
    }, [ref]);

    const handleConfirm = useCallback(() => {
      onConfirm(amount);
      closeSheet();
    }, [amount, onConfirm, closeSheet]);

    const isMaxSelected =
      walletBalance != null &&
      walletBalance > 0 &&
      parseFloat(amount) === Math.floor(walletBalance * 100) / 100;

    const formatBalance = (bal: number): string => {
      return bal.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    return (
      <BaseSheet
        ref={ref}
        title={t('Stake Amount')}
        enableDynamicSizing={false}
        snapPoints={['50%']}
        onClose={() => {
          isOpen.current = false;
          Keyboard.dismiss();
          onClose?.();
        }}
        onOpen={() => {
          isOpen.current = true;
          setHasBeenOpened(true);
        }}
      >
        {hasBeenOpened && (
          <View style={localStyles.container}>
            {/* Custom amount input — at top so keyboard doesn't cover it */}
            <View
              style={[localStyles.inputRow, { borderColor: colors.border }]}
            >
              <Text
                style={[
                  localStyles.dollarSign,
                  { color: colors.textSecondary },
                ]}
              >
                $
              </Text>
              <BottomSheetTextInput
                style={[localStyles.input, { color: colors.text }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType='decimal-pad'
                placeholder='0.00'
                placeholderTextColor={colors.textSecondary}
                selectionColor={colors.primary}
              />
              <Text
                style={[
                  localStyles.usdcLabel,
                  { color: colors.textSecondary },
                ]}
              >
                USDC
              </Text>
            </View>

            {/* Balance display */}
            <View
              style={[
                localStyles.balanceRow,
                { backgroundColor: colors.cardBackground },
              ]}
            >
              <Text
                style={[
                  localStyles.balanceLabel,
                  { color: colors.textSecondary },
                ]}
              >
                {t('Balance')}
              </Text>
              <Text
                style={[localStyles.balanceValue, { color: colors.text }]}
              >
                {balanceLoading
                  ? '...'
                  : walletBalance != null
                    ? `${formatBalance(walletBalance)} USDC`
                    : '—'}
              </Text>
            </View>

            {/* Preset buttons */}
            <View style={localStyles.presetRow}>
              {PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  style={[
                    localStyles.presetButton,
                    {
                      backgroundColor:
                        selectedPreset === preset
                          ? colors.primary
                          : colors.cardBackground,
                      borderColor:
                        selectedPreset === preset
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                  onPress={() => handlePresetSelect(preset)}
                >
                  <Text
                    style={[
                      localStyles.presetText,
                      {
                        color:
                          selectedPreset === preset
                            ? colors.iconOnPrimary
                            : colors.text,
                      },
                    ]}
                  >
                    ${preset}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[
                  localStyles.presetButton,
                  {
                    backgroundColor: isMaxSelected
                      ? colors.primary
                      : colors.cardBackground,
                    borderColor: isMaxSelected
                      ? colors.primary
                      : colors.border,
                  },
                ]}
                onPress={handleMax}
                disabled={walletBalance == null || walletBalance <= 0}
              >
                <Text
                  style={[
                    localStyles.presetText,
                    {
                      color: isMaxSelected
                        ? colors.iconOnPrimary
                        : walletBalance == null || walletBalance <= 0
                          ? colors.textSecondary
                          : colors.text,
                    },
                  ]}
                >
                  {t('Max')}
                </Text>
              </Pressable>
            </View>

            {/* Confirm / Cancel */}
            <Row>
              <RoundButton
                variant='secondary'
                icon='close'
                onPress={closeSheet}
              />
              <RoundButton
                icon='checkmark'
                onPress={handleConfirm}
                disabled={!amount || parseFloat(amount) <= 0}
              />
            </Row>
          </View>
        )}
      </BaseSheet>
    );
  }
);

StakeAmountSheet.displayName = 'StakeAmountSheet';

const localStyles = StyleSheet.create({
  container: {
    gap: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  balanceLabel: {
    fontSize: 14,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    minWidth: 56,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dollarSign: {
    fontSize: 20,
    fontWeight: '500',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    padding: 0,
  },
  usdcLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});
