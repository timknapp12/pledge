import { StyleSheet } from 'react-native';

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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
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
