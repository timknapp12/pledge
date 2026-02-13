import { forwardRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { BaseSheet } from './BaseSheet';
import { RoundButton, Row } from '../common';

interface DateTimePickerSheetProps {
  title: string;
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: 'date' | 'time' | 'datetime';
  onConfirm: (date: Date) => void;
  onClose?: () => void;
}

export const DateTimePickerSheet = forwardRef<
  BottomSheet,
  DateTimePickerSheetProps
>(
  (
    {
      title,
      value,
      minimumDate,
      maximumDate,
      mode = 'datetime',
      onConfirm,
      onClose,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const { isDark } = useThemeMode();
    const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

    const [selectedDate, setSelectedDate] = useState(value);
    const [hasBeenOpened, setHasBeenOpened] = useState(false);

    useEffect(() => {
      setSelectedDate(value);
    }, [value]);

    const openPicker = useCallback(
      (pickerMode: 'date' | 'time') => {
        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: pickerMode,
          display: 'spinner',
          minimumDate: pickerMode === 'date' ? minimumDate : undefined,
          maximumDate: pickerMode === 'date' ? maximumDate : undefined,
          onChange: (event, date) => {
            if (event.type === 'dismissed' || !date) return;
            setSelectedDate(date);
          },
        });
      },
      [selectedDate, minimumDate, maximumDate]
    );

    const handleConfirm = useCallback(() => {
      onConfirm(selectedDate);
      if (ref && 'current' in ref && ref.current) {
        ref.current.close();
      }
    }, [selectedDate, onConfirm, ref]);

    const handleSetNow = useCallback(() => {
      setSelectedDate(new Date());
    }, []);

    const formatDate = (date: Date) =>
      date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    const formatTime = (date: Date) =>
      date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });

    return (
      <BaseSheet
        ref={ref}
        title={title}
        snapPoints={['40%']}
        onClose={onClose}
        onOpen={() => setHasBeenOpened(true)}
      >
        {hasBeenOpened && (
          <View style={styles.container}>
            <Pressable style={styles.quickAction} onPress={handleSetNow}>
              <Text style={[styles.quickActionText, { color: colors.primary }]}>
                {t('Set to Now')}
              </Text>
            </Pressable>

            {mode === 'datetime' && (
              <View style={styles.modeSelector}>
                <Pressable
                  style={[
                    styles.modeButton,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => openPicker('date')}
                >
                  <Text
                    style={[styles.modeButtonText, { color: colors.text }]}
                  >
                    {formatDate(selectedDate)}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modeButton,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => openPicker('time')}
                >
                  <Text
                    style={[styles.modeButtonText, { color: colors.text }]}
                  >
                    {formatTime(selectedDate)}
                  </Text>
                </Pressable>
              </View>
            )}

            {mode !== 'datetime' && (
              <Pressable
                style={[
                  styles.modeButton,
                  styles.singleModeButton,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => openPicker(mode)}
              >
                <Text style={[styles.modeButtonText, { color: colors.text }]}>
                  {mode === 'date'
                    ? formatDate(selectedDate)
                    : formatTime(selectedDate)}
                </Text>
              </Pressable>
            )}

            <Row>
              <RoundButton
                variant='secondary'
                icon='close'
                onPress={() => {
                  if (ref && 'current' in ref && ref.current) {
                    ref.current.close();
                  }
                }}
              />
              <RoundButton icon='checkmark' onPress={handleConfirm} />
            </Row>
          </View>
        )}
      </BaseSheet>
    );
  }
);

DateTimePickerSheet.displayName = 'DateTimePickerSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  quickAction: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modeButton: {
    padding: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  singleModeButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
