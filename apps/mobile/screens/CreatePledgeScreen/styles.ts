import { StyleSheet } from 'react-native';

const valueBase = { flex: 1, minWidth: 0 };

export const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 16,
    marginBottom: 24,
    width: '100%',
  },
  scheduleCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  scheduleRowReminders: {
    alignItems: 'flex-start',
  },
  scheduleRowValue: {
    ...valueBase,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleRowValueText: valueBase,
  scheduleRowChevron: {
    flexShrink: 0,
  },
  scheduleDivider: {
    height: 1,
    marginLeft: 16,
  },
  dateChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  durationBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  todoRow: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 12,
  },
  summaryLabel: {
    flexShrink: 0,
  },
  summaryValue: {
    ...valueBase,
    alignItems: 'flex-end',
  },
  summaryValueText: {
    textAlign: 'right',
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  addButton: {
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
});
