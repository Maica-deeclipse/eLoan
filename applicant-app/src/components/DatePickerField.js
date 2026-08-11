import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';

const MONTHS_LIST = [
  { label: 'January', value: '01' },   { label: 'February', value: '02' },
  { label: 'March', value: '03' },     { label: 'April', value: '04' },
  { label: 'May', value: '05' },       { label: 'June', value: '06' },
  { label: 'July', value: '07' },      { label: 'August', value: '08' },
  { label: 'September', value: '09' }, { label: 'October', value: '10' },
  { label: 'November', value: '11' },  { label: 'December', value: '12' },
];

/**
 * DatePickerField — scrollable Month/Day/Year calendar picker.
 *
 * Props:
 *   value       {string}   YYYY-MM-DD string (or empty)
 *   onChange    {function} called with new YYYY-MM-DD string
 *   title       {string}   modal header title (default "Select Date")
 *   placeholder {string}   button placeholder text (default "Select date")
 *   style       {object}   optional style overrides for the trigger button
 */
export default function DatePickerField({
  value,
  onChange,
  title = 'Select Date',
  placeholder = 'Select date',
  style,
}) {
  const [open, setOpen] = useState(false);

  const _cur = new Date().getFullYear();
  const YEARS = Array.from(
    { length: _cur - 18 - (_cur - 100) + 1 },
    (_, i) => String(_cur - 100 + i),
  );

  const getDaysInMonth = (y, m) =>
    !y || !m ? 31 : new Date(parseInt(y), parseInt(m), 0).getDate();

  const initParts = () => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return { y, m, d };
    }
    return { y: String(_cur - 25), m: '01', d: '01' };
  };

  const [selYear, setSelYear] = useState(() => initParts().y);
  const [selMonth, setSelMonth] = useState(() => initParts().m);
  const [selDay, setSelDay] = useState(() => initParts().d);

  const DAYS = Array.from(
    { length: getDaysInMonth(selYear, selMonth) },
    (_, i) => String(i + 1).padStart(2, '0'),
  );

  const confirm = () => {
    const maxDay = getDaysInMonth(selYear, selMonth);
    const safeDay = String(Math.min(parseInt(selDay, 10), maxDay)).padStart(2, '0');
    onChange(`${selYear}-${selMonth}-${safeDay}`);
    setSelDay(safeDay);
    setOpen(false);
  };

  const displayValue = (() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-');
    const mon = MONTHS_LIST.find(mo => mo.value === m);
    return `${mon ? mon.label : m} ${parseInt(d, 10)}, ${y}`;
  })();

  return (
    <View>
      <TouchableOpacity
        style={[styles.btn, style]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.btnText, !displayValue && styles.placeholder]}>
          {displayValue || placeholder}
        </Text>
        <Text style={styles.arrow}>📅</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.columns}>
              {/* Month */}
              <View style={styles.colWrap}>
                <Text style={styles.colLabel}>Month</Text>
                <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                  {MONTHS_LIST.map(m => (
                    <TouchableOpacity
                      key={m.value}
                      style={[styles.item, selMonth === m.value && styles.itemSel]}
                      onPress={() => setSelMonth(m.value)}
                    >
                      <Text style={[styles.itemText, selMonth === m.value && styles.itemTextSel]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Day */}
              <View style={[styles.colWrap, { flex: 0, width: 72 }]}>
                <Text style={styles.colLabel}>Day</Text>
                <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                  {DAYS.map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.item, selDay === d && styles.itemSel]}
                      onPress={() => setSelDay(d)}
                    >
                      <Text style={[styles.itemText, selDay === d && styles.itemTextSel]}>
                        {parseInt(d, 10)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year */}
              <View style={[styles.colWrap, { flex: 0, width: 84 }]}>
                <Text style={styles.colLabel}>Year</Text>
                <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                  {YEARS.map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.item, selYear === y && styles.itemSel]}
                      onPress={() => setSelYear(y)}
                    >
                      <Text style={[styles.itemText, selYear === y && styles.itemTextSel]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={confirm}>
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d1d5db',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13,
  },
  btnText: { fontSize: 15, color: '#1f2937', flex: 1 },
  placeholder: { color: '#9ca3af' },
  arrow: { fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  cancel: { fontSize: 14, color: '#6b7280' },
  columns: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  colWrap: { flex: 1 },
  colLabel: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af', textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 0.5, paddingRight: 0.5, marginBottom: 6,
  },
  col: { height: 210, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10 },
  item: { paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center' },
  itemSel: { backgroundColor: '#eff6ff' },
  itemText: { fontSize: 14, color: '#374151' },
  itemTextSel: { color: '#02327a', fontWeight: '700' },
  confirmBtn: {
    marginHorizontal: 20, marginTop: 16, backgroundColor: '#02327a',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
