import 'package:flutter_test/flutter_test.dart';
import 'package:sa_traders_billing/core/widgets/common.dart';

void main() {
  test('shows the full date while leaving ISO billing keys untouched', () {
    const stored = '2026-11-05';
    expect(displayDate(stored), '05 Nov 2026');
    expect(stored, '2026-11-05');
    expect(displayDate(DateTime(2026, 10, 17)), '17 Oct 2026');
    expect(displayDate(null), '—');
  });
}
